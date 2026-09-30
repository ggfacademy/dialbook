// Dialbook Pro – "whatsapp-webhook" edge function
// Receives incoming WhatsApp messages and delivery updates from every connected number.
// Turn OFF "Verify JWT" for this function. Each number has its own address:
//   https://<project>.supabase.co/functions/v1/whatsapp-webhook?a=<number id>&t=<token>
// (The CRM shows the exact address in Settings → WhatsApp.)
//
// Understands: Meta WhatsApp Cloud API, Twilio, the Evolution API gateway (own WhatsApp by QR),
// and any other provider for which you set the "incoming message" field paths.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const ok = (msg = "ok") => new Response(JSON.stringify({ ok: true, msg }), { headers: { "Content-Type": "application/json" } });
type Obj = Record<string, any>;

const pkey = (p: string) => String(p || "").replace(/\D/g, "").slice(-10);
function pick(o: unknown, path: string): unknown {
  if (!path) return undefined;
  return path.split(".").reduce((a: any, k) => (a == null ? undefined : a[/^\d+$/.test(k) ? Number(k) : k]), o);
}
async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Incoming = { phone: string; body: string; id: string; at?: string; name?: string; media?: string; fromMe?: boolean };

/** Finds the lead for a phone number, or creates one when that is allowed. */
async function leadFor(acc: Obj, phone: string, name: string | undefined, createIfMissing: boolean): Promise<Obj | null> {
  const k = pkey(phone);
  if (k.length < 6) return null;
  const { data } = await admin.from("leads").select("id,name,assigned_to").eq("phone_key", k).order("updated_at", { ascending: false }).limit(1);
  if (data && data.length) return data[0];
  if (!createIfMissing) return null;
  const { data: st } = await admin.from("settings").select("data").eq("id", 1).single();
  if (st?.data?.autoCreateIncoming === false) return null;
  const { data: l } = await admin.from("leads").insert({
    name: name || `WhatsApp ${k.slice(-4)}`, phone: "+" + String(phone).replace(/\D/g, ""), source: "WhatsApp",
    assigned_to: acc.provider === "qr" ? acc.owner_id : null, created_by: acc.owner_id || null,
  }).select("id,name,assigned_to").single();
  if (l) await admin.from("activities").insert({ lead_id: l.id, kind: "created", text: "WhatsApp message" });
  return l;
}

async function storeIncoming(acc: Obj, m: Incoming) {
  // Personal WhatsApp (QR): only chats with existing leads are stored, never personal chats.
  const lead = await leadFor(acc, m.phone, m.name, acc.provider !== "qr" && !m.fromMe);
  if (!lead) return;
  const row: Obj = {
    account_id: acc.id, lead_id: lead.id, phone_key: pkey(m.phone),
    direction: m.fromMe ? "out" : "in", sender_id: m.fromMe ? acc.owner_id : null,
    body: m.body || "", media_type: m.media || null, status: m.fromMe ? "sent" : "received",
    provider_id: m.id || null, created_at: m.at || new Date().toISOString(),
  };
  const { error } = await admin.from("wa_messages").insert(row);
  if (error && !String(error.message).includes("duplicate")) console.error(error.message);
  if (!error) await admin.from("leads").update({ updated_at: new Date().toISOString() }).eq("id", lead.id);
}

async function storeStatus(acc: Obj, providerId: string, status: string, err?: string) {
  if (!providerId) return;
  const rank: Record<string, number> = { failed: 9, read: 4, delivered: 3, sent: 2, queued: 1 };
  const { data: m } = await admin.from("wa_messages").select("id,status").eq("account_id", acc.id).eq("provider_id", providerId).maybeSingle();
  if (!m) return;
  if ((rank[status] || 0) < (rank[m.status] || 0) && status !== "failed") return;
  await admin.from("wa_messages").update({ status, error: err || null }).eq("id", m.id);
}

/* ---------------- Meta ---------------- */
function metaText(msg: Obj): { body: string; media?: string } {
  switch (msg.type) {
    case "text": return { body: msg.text?.body || "" };
    case "button": return { body: msg.button?.text || "" };
    case "interactive": return { body: msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || "" };
    case "image": case "video": case "document": case "audio": case "sticker":
      return { body: msg[msg.type]?.caption || `[${msg.type}]`, media: msg.type };
    case "location": return { body: `[location] ${msg.location?.latitude},${msg.location?.longitude}` };
    default: return { body: `[${msg.type || "message"}]` };
  }
}
async function handleMeta(acc: Obj, p: Obj) {
  for (const e of p.entry || []) for (const ch of e.changes || []) {
    const v = ch.value || {};
    const names: Record<string, string> = {};
    for (const c of v.contacts || []) names[c.wa_id] = c.profile?.name;
    for (const msg of v.messages || []) {
      const t = metaText(msg);
      await storeIncoming(acc, { phone: msg.from, body: t.body, media: t.media, id: msg.id, name: names[msg.from],
        at: msg.timestamp ? new Date(Number(msg.timestamp) * 1000).toISOString() : undefined });
    }
    for (const s of v.statuses || []) {
      await storeStatus(acc, s.id, s.status, s.errors?.[0]?.error_data?.details || s.errors?.[0]?.title);
    }
  }
}

/* ---------------- Twilio ---------------- */
async function handleTwilio(acc: Obj, f: URLSearchParams) {
  const sid = f.get("MessageSid") || f.get("SmsSid") || "";
  const st = (f.get("MessageStatus") || f.get("SmsStatus") || "").toLowerCase();
  if (f.get("Body") !== null && (st === "received" || !st) && f.get("From")) {
    const n = Number(f.get("NumMedia") || 0);
    await storeIncoming(acc, { phone: String(f.get("From")).replace("whatsapp:", ""), body: f.get("Body") || (n ? "[media]" : ""),
      media: n ? "media" : undefined, id: sid, name: f.get("ProfileName") || undefined });
    return;
  }
  const map: Record<string, string> = { queued: "queued", accepted: "queued", sending: "queued", sent: "sent", delivered: "delivered", read: "read", failed: "failed", undelivered: "failed" };
  if (map[st]) await storeStatus(acc, sid, map[st], f.get("ErrorMessage") || f.get("ErrorCode") || undefined);
}

/* ---------------- Evolution API gateway (QR) ---------------- */
function evoText(m: Obj): { body: string; media?: string } {
  if (!m) return { body: "" };
  if (m.conversation) return { body: m.conversation };
  if (m.extendedTextMessage?.text) return { body: m.extendedTextMessage.text };
  for (const k of ["imageMessage", "videoMessage", "documentMessage", "audioMessage", "stickerMessage"]) {
    if (m[k]) return { body: m[k].caption || `[${k.replace("Message", "")}]`, media: k.replace("Message", "") };
  }
  if (m.buttonsResponseMessage) return { body: m.buttonsResponseMessage.selectedDisplayText || "" };
  if (m.listResponseMessage) return { body: m.listResponseMessage.title || "" };
  return { body: "[message]" };
}
async function handleEvolution(acc: Obj, p: Obj) {
  const ev = String(p.event || "").toLowerCase().replace(/_/g, ".");
  if (ev === "connection.update") {
    const state = p.data?.state;
    const status = state === "open" ? "connected" : state === "connecting" ? "setup" : "disconnected";
    const upd: Obj = { status, updated_at: new Date().toISOString() };
    const wuid = p.data?.wuid || p.sender;
    if (state === "open" && wuid) upd.phone = "+" + String(wuid).split("@")[0].replace(/\D/g, "");
    await admin.from("wa_accounts").update(upd).eq("id", acc.id);
    return;
  }
  if (ev === "messages.upsert" || ev === "send.message") {
    const list = Array.isArray(p.data) ? p.data : Array.isArray(p.data?.messages) ? p.data.messages : [p.data];
    for (const d of list) {
      const jid = String(d?.key?.remoteJid || "");
      if (!jid || jid.endsWith("@g.us") || jid.includes("broadcast") || jid.endsWith("@newsletter")) continue;
      const phone = (d.key?.remoteJidAlt || d.key?.senderPn || jid).split("@")[0];
      const t = evoText(d.message);
      const ts = Number(d.messageTimestamp || 0);
      await storeIncoming(acc, { phone, body: t.body, media: t.media, id: d.key?.id || "", name: d.key?.fromMe ? undefined : d.pushName,
        fromMe: !!d.key?.fromMe, at: ts ? new Date(ts * 1000).toISOString() : undefined });
    }
    return;
  }
  if (ev === "messages.update") {
    const list = Array.isArray(p.data) ? p.data : [p.data];
    const map: Record<string, string> = { SERVER_ACK: "sent", DELIVERY_ACK: "delivered", READ: "read", PLAYED: "read", ERROR: "failed" };
    for (const d of list) {
      const id = d?.keyId || d?.key?.id || d?.messageId;
      const st = map[String(d?.status || d?.update?.status || "")];
      if (id && st) await storeStatus(acc, id, st);
    }
  }
}

/* ---------------- Any other provider ---------------- */
async function handleCustom(acc: Obj, p: Obj) {
  const c = acc.config?.inbound || {};
  const items = c.list_path ? (pick(p, c.list_path) as unknown[] || []) : [p];
  for (const it of items) {
    if (c.status_id_path && c.status_path) {
      const sid = pick(it, c.status_id_path), st = pick(it, c.status_path);
      if (sid && st) { await storeStatus(acc, String(sid), String(st).toLowerCase()); continue; }
    }
    const phone = pick(it, c.from_path || "from"), body = pick(it, c.text_path || "text");
    if (!phone) continue;
    await storeIncoming(acc, { phone: String(phone), body: String(body ?? ""), id: String(pick(it, c.id_path || "id") ?? ""), name: c.name_path ? String(pick(it, c.name_path) ?? "") : undefined });
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("a") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("unknown", { status: 404 });
  const { data: acc } = await admin.from("wa_accounts").select("*").eq("id", id).maybeSingle();
  if (!acc) return new Response("unknown", { status: 404 });

  // Meta's one-time address check
  if (req.method === "GET") {
    if (url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === acc.webhook_token) {
      return new Response(url.searchParams.get("hub.challenge") || "", { status: 200 });
    }
    return new Response("forbidden", { status: 403 });
  }
  if (req.method !== "POST") return ok("ignored");

  const raw = await req.text();
  const token = url.searchParams.get("t");
  let trusted = token === acc.webhook_token;
  // Meta can also be verified by its signature when an App Secret is saved.
  if (!trusted && acc.provider === "meta") {
    const { data: s } = await admin.from("wa_secrets").select("data").eq("account_id", acc.id).maybeSingle();
    const sig = req.headers.get("x-hub-signature-256") || "";
    if (s?.data?.app_secret && sig === "sha256=" + await hmacHex(s.data.app_secret, raw)) trusted = true;
  }
  if (!trusted) return new Response("forbidden", { status: 403 });

  try {
    if (acc.provider === "twilio") await handleTwilio(acc, new URLSearchParams(raw));
    else {
      const p = JSON.parse(raw || "{}");
      if (acc.provider === "meta") await handleMeta(acc, p);
      else if (acc.provider === "qr") await handleEvolution(acc, p);
      else await handleCustom(acc, p);
    }
  } catch (e) {
    console.error("webhook error", e);
  }
  // Twilio expects an XML (or empty) answer; others accept any 200.
  if (acc.provider === "twilio") return new Response("<Response></Response>", { headers: { "Content-Type": "text/xml" } });
  return ok();
});
