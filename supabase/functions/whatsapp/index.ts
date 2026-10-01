// Dialbook Pro – "whatsapp" edge function (keep "Verify JWT" ON)
// Sends WhatsApp messages and manages connected numbers for the CRM website.
//
// Actions (POST JSON { action, ... }):
//   status                                  → { gateway: boolean, gatewayUrl }
//   set_gateway   { url, api_key }          admin: address + key of the WhatsApp gateway (for QR login)
//   save_account  { id?, name, provider, shared, phone, config, secrets }   admin
//   delete_account{ id }                    admin, or the owner of a QR account
//   sync_templates{ account_id }            admin: fetch approved templates (Meta, Twilio)
//   send          { lead_id, account_id, text? | template_id + params[] + header_url? }
//   qr_start      { }                       any user: link their own WhatsApp, returns QR
//   qr_status     { account_id }
//   qr_logout     { account_id }
//   test_account  { account_id }            admin: checks the credentials work

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SB_URL, SERVICE);
const HOOK = `${SB_URL}/functions/v1/whatsapp-webhook`;

type Obj = Record<string, any>;
class UserError extends Error {}

export function digits(p: string): string {
  let d = String(p || "").replace(/\D/g, "");
  d = d.replace(/^0+/, "");
  if (d.length === 10) d = "91" + d;
  return d;
}
const pkey = (p: string) => String(p || "").replace(/\D/g, "").slice(-10);

/** Replaces {{name}} placeholders; values are JSON-escaped when the text is JSON. */
export function fill(tpl: string, vars: Obj, forJson: boolean): string {
  return String(tpl || "").replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, k) => {
    const v = vars[k] ?? "";
    if (typeof v !== "string") return JSON.stringify(v); // lists (params_json) go in as real JSON
    return forJson ? JSON.stringify(v).slice(1, -1) : v;
  });
}
export function pick(o: unknown, path: string): unknown {
  if (!path) return undefined;
  return path.split(".").reduce((a: any, k) => (a == null ? undefined : a[/^\d+$/.test(k) ? Number(k) : k]), o);
}
export function renderTemplate(body: string, params: string[]): string {
  return String(body || "").replace(/\{\{(\d+)\}\}/g, (_m, n) => params[Number(n) - 1] ?? "");
}

async function gateway(): Promise<{ url: string; key: string }> {
  const { data } = await admin.from("wa_gateway").select("*").eq("id", 1).maybeSingle();
  if (!data?.url || !data?.api_key) throw new UserError("The WhatsApp gateway is not set up yet. An admin can add it in Settings → WhatsApp.");
  return { url: String(data.url).replace(/\/+$/, ""), key: data.api_key };
}
async function gw(path: string, method = "GET", body?: unknown): Promise<{ ok: boolean; status: number; data: any }> {
  const g = await gateway();
  const r = await fetch(g.url + path, {
    method,
    headers: { apikey: g.key, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}
const gwError = (d: any) => {
  const m = d?.response?.message ?? d?.message ?? d?.error;
  return Array.isArray(m) ? m.join(", ") : typeof m === "string" ? m : JSON.stringify(m ?? d);
};

/* ------------------------------------------------------------------ */
/* Provider senders. Each returns the provider's message id.          */
/* ------------------------------------------------------------------ */
type SendReq = { to: string; text?: string; template?: Obj; params: string[]; header?: { type: string; url: string } };

async function sendMeta(cfg: Obj, sec: Obj, m: SendReq): Promise<string> {
  const v = cfg.api_version || "v23.0";
  const body: Obj = { messaging_product: "whatsapp", recipient_type: "individual", to: m.to };
  if (m.template) {
    body.type = "template";
    body.template = { name: m.template.name, language: { code: m.template.language || "en" } };
    const comps: Obj[] = [];
    if (m.header) comps.push({ type: "header", parameters: [{ type: m.header.type, [m.header.type]: { link: m.header.url } }] });
    if (m.params.length) comps.push({ type: "body", parameters: m.params.map((t) => ({ type: "text", text: t || "-" })) });
    if (comps.length) body.template.components = comps;
  } else {
    body.type = "text";
    body.text = { preview_url: true, body: m.text };
  }
  const r = await fetch(`https://graph.facebook.com/${v}/${cfg.phone_number_id}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sec.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = j?.error;
    let msg = e?.error_data?.details || e?.message || `Meta answered ${r.status}`;
    if (e?.code === 131047) msg = "More than 24 hours have passed since the customer last replied. Send an approved template instead.";
    throw new UserError(msg);
  }
  return j?.messages?.[0]?.id || "";
}

async function sendTwilio(cfg: Obj, sec: Obj, m: SendReq): Promise<string> {
  const f = new URLSearchParams();
  const from = String(cfg.from || "").startsWith("whatsapp:") ? cfg.from : `whatsapp:+${digits(cfg.from)}`;
  if (cfg.messaging_service_sid) f.set("MessagingServiceSid", cfg.messaging_service_sid); else f.set("From", from);
  f.set("To", `whatsapp:+${m.to}`);
  if (m.template) {
    f.set("ContentSid", m.template.external_id);
    if (m.params.length) f.set("ContentVariables", JSON.stringify(Object.fromEntries(m.params.map((p, i) => [String(i + 1), p]))));
  } else f.set("Body", m.text || "");
  f.set("StatusCallback", `${HOOK}?a=${cfg.__id}&t=${cfg.__token}`);
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.account_sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`${cfg.account_sid}:${sec.auth_token}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: f.toString(),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new UserError(j?.message || `Twilio answered ${r.status}`);
  return j?.sid || "";
}

async function sendCustom(cfg: Obj, sec: Obj, m: SendReq): Promise<string> {
  const vars: Obj = {
    to: "+" + m.to, to_digits: m.to, to_local: m.to.slice(-10), text: m.text || "",
    template: m.template?.name || "", language: m.template?.language || "en",
    params_json: m.params, header_type: m.header?.type || "", header_url: m.header?.url || "",
    header_values_json: m.header ? [m.header.url] : [], ...Object.fromEntries(m.params.map((p, i) => [`param${i + 1}`, p])),
    ...Object.fromEntries(Object.entries(sec).map(([k, v]) => [`secret.${k}`, v])),
  };
  const bodyTpl = m.template ? (cfg.template_body || cfg.text_body) : cfg.text_body;
  if (!bodyTpl) throw new UserError(m.template ? "This provider has no template message format set up." : "This provider has no text message format set up.");
  const url = fill(m.template && cfg.template_url ? cfg.template_url : cfg.url, vars, false);
  let headers: Obj = { "Content-Type": "application/json" };
  try { headers = { ...headers, ...JSON.parse(fill(cfg.headers || "{}", vars, true)) }; } catch { throw new UserError("The headers for this provider are not valid JSON."); }
  const body = fill(bodyTpl, vars, String(headers["Content-Type"] || "").includes("json"));
  const r = await fetch(url, { method: cfg.method || "POST", headers, body });
  const text = await r.text();
  let j: unknown = {}; try { j = JSON.parse(text); } catch { /* plain text answer */ }
  if (!r.ok) throw new UserError(`Provider answered ${r.status}: ${text.slice(0, 200)}`);
  const id = pick(j, cfg.id_path || "");
  return id == null ? "" : String(id);
}

async function sendQr(cfg: Obj, m: SendReq): Promise<string> {
  const text = m.template ? renderTemplate(m.template.body, m.params) : (m.text || "");
  const r = await gw(`/message/sendText/${encodeURIComponent(cfg.instance)}`, "POST", { number: m.to, text });
  if (!r.ok) {
    if (r.status === 404) throw new UserError("This WhatsApp is not linked any more. Scan the QR code again in Settings → WhatsApp.");
    throw new UserError("WhatsApp gateway: " + gwError(r.data));
  }
  return r.data?.key?.id || "";
}

/* ------------------------------------------------------------------ */
/* Own WhatsApp via QR (Evolution API gateway)                        */
/* ------------------------------------------------------------------ */
async function setGatewayWebhook(instance: string, url: string) {
  const events = ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE", "SEND_MESSAGE"];
  let r = await gw(`/webhook/set/${encodeURIComponent(instance)}`, "POST", { webhook: { enabled: true, url, byEvents: false, base64: false, events } });
  if (!r.ok) r = await gw(`/webhook/set/${encodeURIComponent(instance)}`, "POST", { enabled: true, url, webhookByEvents: false, webhookBase64: false, events });
  if (!r.ok) throw new UserError("Could not connect the gateway to the CRM: " + gwError(r.data));
}

async function qrConnect(acc: Obj) {
  const inst = acc.config.instance;
  let c = await gw(`/instance/connect/${encodeURIComponent(inst)}`);
  if (c.status === 404) {
    const cr = await gw(`/instance/create`, "POST", { instanceName: inst, qrcode: true, integration: "WHATSAPP-BAILEYS" });
    if (!cr.ok && cr.status !== 403 && cr.status !== 409) throw new UserError("Gateway: " + gwError(cr.data));
    await setGatewayWebhook(inst, `${HOOK}?a=${acc.id}&t=${acc.webhook_token}`);
    c = await gw(`/instance/connect/${encodeURIComponent(inst)}`);
  } else {
    await setGatewayWebhook(inst, `${HOOK}?a=${acc.id}&t=${acc.webhook_token}`);
  }
  const state = c.data?.instance?.state || c.data?.state || "";
  const qrImage = c.data?.base64 || c.data?.qrcode?.base64 || "";
  const qrCode = c.data?.code || c.data?.qrcode?.code || "";
  if (state === "open") await admin.from("wa_accounts").update({ status: "connected", updated_at: new Date().toISOString() }).eq("id", acc.id);
  return { account_id: acc.id, state: state || (qrImage || qrCode ? "qr" : "unknown"), qr_image: qrImage, qr_code: qrCode, pairing_code: c.data?.pairingCode || "" };
}

async function qrState(acc: Obj): Promise<string> {
  const r = await gw(`/instance/connectionState/${encodeURIComponent(acc.config.instance)}`);
  const state = r.data?.instance?.state || r.data?.state || (r.status === 404 ? "missing" : "unknown");
  const status = state === "open" ? "connected" : state === "connecting" ? "setup" : "disconnected";
  if (status !== acc.status) await admin.from("wa_accounts").update({ status, updated_at: new Date().toISOString() }).eq("id", acc.id);
  return state;
}

/* ------------------------------------------------------------------ */
/* Templates                                                          */
/* ------------------------------------------------------------------ */
const countParams = (body: string) => { let n = 0; for (const m of body.matchAll(/\{\{(\d+)\}\}/g)) n = Math.max(n, Number(m[1])); return n; };

async function syncTemplates(acc: Obj, sec: Obj): Promise<number> {
  const rows: Obj[] = [];
  if (acc.provider === "meta") {
    const v = acc.config.api_version || "v23.0";
    let url: string | null = `https://graph.facebook.com/${v}/${acc.config.waba_id}/message_templates?fields=name,language,status,category,components&limit=200`;
    while (url) {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${sec.token}` } });
      const j = await r.json();
      if (!r.ok) throw new UserError(j?.error?.message || "Meta did not return templates");
      for (const t of j.data || []) {
        const body = (t.components || []).find((c: Obj) => c.type === "BODY")?.text || "";
        rows.push({ account_id: acc.id, name: t.name, language: t.language, category: t.category || "", status: t.status || "", body, params: countParams(body), external_id: t.id || "" });
      }
      url = j?.paging?.next || null;
    }
  } else if (acc.provider === "twilio") {
    let url: string | null = "https://content.twilio.com/v1/Content?PageSize=100";
    while (url) {
      const r = await fetch(url, { headers: { Authorization: "Basic " + btoa(`${acc.config.account_sid}:${sec.auth_token}`) } });
      const j = await r.json();
      if (!r.ok) throw new UserError(j?.message || "Twilio did not return templates");
      for (const t of j.contents || []) {
        const types = t.types || {};
        const first = Object.values(types)[0] as Obj | undefined;
        const body = types["twilio/text"]?.body || first?.body || "";
        rows.push({ account_id: acc.id, name: t.friendly_name || t.sid, language: t.language || "en", category: "", status: "SYNCED", body, params: countParams(body), external_id: t.sid });
      }
      url = j?.meta?.next_page_url || null;
    }
  } else {
    throw new UserError("For this kind of number, add templates by hand in Settings → WhatsApp.");
  }
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await admin.from("wa_templates").upsert(rows.slice(i, i + 200).map((r) => ({ ...r, updated_at: new Date().toISOString() })), { onConflict: "account_id,name,language" });
    if (error) throw new Error(error.message);
  }
  return rows.length;
}

/* ------------------------------------------------------------------ */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const userClient = createClient(SB_URL, ANON, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Please sign in again." }, 401);
    const { data: me } = await admin.from("profiles").select("*").eq("id", user.id).single();
    if (!me?.active) return json({ error: "Your account is not approved yet." }, 403);
    const isAdmin = me.role === "admin";
    const isMgr = isAdmin || me.role === "manager";
    const b: Obj = await req.json();

    const loadAccount = async (id: string) => {
      const { data: acc } = await admin.from("wa_accounts").select("*").eq("id", id).maybeSingle();
      if (!acc) throw new UserError("That WhatsApp number was not found.");
      const { data: s } = await admin.from("wa_secrets").select("data").eq("account_id", id).maybeSingle();
      return { acc, sec: (s?.data || {}) as Obj };
    };

    switch (b.action) {
      case "status": {
        const { data } = await admin.from("wa_gateway").select("url,api_key").eq("id", 1).maybeSingle();
        return json({ gateway: !!(data?.url && data?.api_key), gatewayUrl: isAdmin ? data?.url || "" : "" });
      }
      case "set_gateway": {
        if (!isAdmin) throw new UserError("Only admins can change this.");
        const url = String(b.url || "").trim().replace(/\/+$/, "");
        if (url && !/^https:\/\//.test(url)) throw new UserError("The gateway address must start with https://");
        const row: Obj = { id: 1, url };
        if (b.api_key) row.api_key = String(b.api_key).trim();
        const { error } = await admin.from("wa_gateway").upsert(row);
        if (error) throw new Error(error.message);
        if (url) { const t = await gw("/instance/fetchInstances"); if (!t.ok) throw new UserError(`Saved, but the gateway did not answer correctly (${t.status}). Check the address and key.`); }
        return json({ ok: true });
      }
      case "save_account": {
        if (!isAdmin) throw new UserError("Only admins can connect company numbers.");
        if (!["meta", "twilio", "custom"].includes(b.provider)) throw new UserError("Unknown provider.");
        const row: Obj = { name: String(b.name || "WhatsApp").trim(), provider: b.provider, shared: b.shared !== false, phone: String(b.phone || ""), config: b.config || {}, updated_at: new Date().toISOString() };
        let id = b.id;
        if (id) { const { error } = await admin.from("wa_accounts").update(row).eq("id", id); if (error) throw new Error(error.message); }
        else { const { data, error } = await admin.from("wa_accounts").insert({ ...row, status: "connected" }).select("id").single(); if (error) throw new Error(error.message); id = data.id; }
        const secrets = Object.fromEntries(Object.entries(b.secrets || {}).filter(([, v]) => v !== "" && v != null));
        if (Object.keys(secrets).length) {
          const { data: old } = await admin.from("wa_secrets").select("data").eq("account_id", id).maybeSingle();
          await admin.from("wa_secrets").upsert({ account_id: id, data: { ...(old?.data || {}), ...secrets } });
        }
        const { data: acc } = await admin.from("wa_accounts").select("*").eq("id", id).single();
        return json({ ok: true, account: acc, webhook_url: `${HOOK}?a=${acc.id}&t=${acc.webhook_token}`, verify_token: acc.webhook_token });
      }
      case "delete_account": {
        const { acc } = await loadAccount(b.id);
        if (!isAdmin && acc.owner_id !== me.id) throw new UserError("You can only remove your own WhatsApp.");
        if (acc.provider === "qr") { try { await gw(`/instance/logout/${encodeURIComponent(acc.config.instance)}`, "DELETE"); await gw(`/instance/delete/${encodeURIComponent(acc.config.instance)}`, "DELETE"); } catch { /* gateway may be gone */ } }
        await admin.from("wa_accounts").delete().eq("id", acc.id);
        return json({ ok: true });
      }
      case "sync_templates": {
        if (!isAdmin) throw new UserError("Only admins can sync templates.");
        const { acc, sec } = await loadAccount(b.account_id);
        return json({ count: await syncTemplates(acc, sec) });
      }
      case "test_account": {
        if (!isAdmin) throw new UserError("Only admins can do this.");
        const { acc, sec } = await loadAccount(b.account_id);
        if (acc.provider === "meta") {
          const r = await fetch(`https://graph.facebook.com/${acc.config.api_version || "v23.0"}/${acc.config.phone_number_id}?fields=display_phone_number,verified_name,quality_rating`, { headers: { Authorization: `Bearer ${sec.token}` } });
          const j = await r.json(); if (!r.ok) throw new UserError(j?.error?.message || "Meta rejected the details");
          await admin.from("wa_accounts").update({ phone: j.display_phone_number || acc.phone, status: "connected" }).eq("id", acc.id);
          return json({ ok: true, message: `Connected: ${j.verified_name || ""} ${j.display_phone_number || ""} (quality ${j.quality_rating || "unknown"})` });
        }
        if (acc.provider === "twilio") {
          const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${acc.config.account_sid}.json`, { headers: { Authorization: "Basic " + btoa(`${acc.config.account_sid}:${sec.auth_token}`) } });
          const j = await r.json(); if (!r.ok) throw new UserError(j?.message || "Twilio rejected the details");
          return json({ ok: true, message: `Connected to Twilio account ${j.friendly_name || ""}` });
        }
        if (acc.provider === "qr") return json({ ok: true, message: `State: ${await qrState(acc)}` });
        return json({ ok: true, message: "Send a message to a test lead to check this provider." });
      }
      case "qr_start": {
        let { data: acc } = await admin.from("wa_accounts").select("*").eq("provider", "qr").eq("owner_id", me.id).maybeSingle();
        if (!acc) {
          const inst = `dialbook_${me.id.replace(/-/g, "").slice(0, 12)}`;
          const { data, error } = await admin.from("wa_accounts").insert({ name: `${me.name}'s WhatsApp`, provider: "qr", owner_id: me.id, shared: false, status: "setup", config: { instance: inst } }).select("*").single();
          if (error) throw new Error(error.message);
          acc = data;
        }
        return json(await qrConnect(acc));
      }
      case "qr_status": {
        const { acc } = await loadAccount(b.account_id);
        if (!isMgr && acc.owner_id !== me.id) throw new UserError("Not your WhatsApp.");
        return json({ state: await qrState(acc) });
      }
      case "qr_logout": {
        const { acc } = await loadAccount(b.account_id);
        if (!isAdmin && acc.owner_id !== me.id) throw new UserError("Not your WhatsApp.");
        await gw(`/instance/logout/${encodeURIComponent(acc.config.instance)}`, "DELETE");
        await admin.from("wa_accounts").update({ status: "disconnected" }).eq("id", acc.id);
        return json({ ok: true });
      }
      case "send": {
        const { data: lead } = await admin.from("leads").select("id,name,phone,assigned_to,dnd").eq("id", b.lead_id).maybeSingle();
        if (!lead) throw new UserError("Lead not found.");
        if (!isMgr && lead.assigned_to !== me.id) throw new UserError("This lead is not assigned to you.");
        const { acc, sec } = await loadAccount(b.account_id);
        if (!acc.shared && acc.owner_id !== me.id) throw new UserError("You can only send from company numbers or your own WhatsApp.");
        const params: string[] = Array.isArray(b.params) ? b.params.map((p: unknown) => String(p ?? "")) : [];
        let template: Obj | undefined;
        if (b.template_id) {
          const { data: t } = await admin.from("wa_templates").select("*").eq("id", b.template_id).maybeSingle();
          if (!t || t.account_id !== acc.id) throw new UserError("That template does not belong to this number.");
          template = t;
        } else if (!String(b.text || "").trim()) throw new UserError("Type a message or pick a template.");
        const to = digits(lead.phone);
        const headerUrl = String(b.header_url || template?.header_url || "").trim();
        if (template?.header_type && !/^https:\/\//i.test(headerUrl)) throw new UserError(`This template needs a public https link to its ${template.header_type}.`);
        const header = template?.header_type ? { type: String(template.header_type), url: headerUrl } : undefined;
        const m: SendReq = { to, text: String(b.text || ""), template, params, header };
        const shown = template ? renderTemplate(template.body || template.name, params) : m.text!;
        let providerId = "", status = "sent", error: string | null = null;
        try {
          const cfg = { ...acc.config, __id: acc.id, __token: acc.webhook_token };
          providerId = acc.provider === "meta" ? await sendMeta(cfg, sec, m)
            : acc.provider === "twilio" ? await sendTwilio(cfg, sec, m)
            : acc.provider === "custom" ? await sendCustom(cfg, sec, m)
            : await sendQr(cfg, m);
        } catch (e) {
          status = "failed"; error = e instanceof Error ? e.message : String(e);
        }
        const row = {
          account_id: acc.id, lead_id: lead.id, phone_key: pkey(lead.phone), direction: "out", sender_id: me.id,
          body: shown, template_name: template?.name || null, status, error, provider_id: providerId || null,
        };
        let { data: msg, error: insErr } = await admin.from("wa_messages").insert(row).select("*").single();
        if (insErr && providerId) {
          // The provider's delivery report arrived first; attach our details to that message.
          ({ data: msg } = await admin.from("wa_messages").update({ sender_id: me.id, template_name: row.template_name, body: shown })
            .eq("account_id", acc.id).eq("provider_id", providerId).select("*").single());
        }
        if (status === "sent") {
          await admin.from("activities").insert({ lead_id: lead.id, actor_id: me.id, kind: "msg", text: template ? `Template: ${template.name}` : shown.slice(0, 120), data: { channel: "whatsapp" } });
          await admin.from("leads").update({ updated_at: new Date().toISOString() }).eq("id", lead.id);
        }
        if (status === "failed") return json({ error, message: msg }, 400);
        return json({ ok: true, message: msg });
      }
    }
    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    if (e instanceof UserError) return json({ error: e.message }, 400);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
