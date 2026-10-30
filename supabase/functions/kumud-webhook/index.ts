// Dialbook Pro – "kumud-webhook" edge function (turn "Verify JWT" OFF)
// Kumud Gemstones only, completely separate from the training lead sources:
//   Meta (Kumud's own app and Page)  →  this function  →  Kumud Order Desk (Google Apps Script), section 6 JSON.
// Kumud leads are NOT saved in Dialbook. Only a technical log (kumud_log: Meta lead id, form id, status, attempts,
// Order Desk reply code) is kept for retries; it has no names, phones, emails or answers, and no login can read it.
//
// Secrets (Supabase → Edge Functions → Secrets), never shown on any screen or in any log:
//   KUMUD_APP_SECRET    the Kumud Meta app's App secret (checks that calls really come from Meta)
//   KUMUD_VERIFY_TOKEN  any long random word, also typed into the Kumud app's Webhooks setup
//   KUMUD_TOKEN         a Kumud System User token (or Page token) with leads_retrieval etc. for the Kumud Page
//   KUMUD_PAGE_ID       the Kumud Facebook Page id; leads from any other Page are ignored
//   KUMUD_ORDER_URL     the Order Desk connection link (…/exec?key=…)
// Scheduler (supabase/kumud.sql): POST {"action":"retry"} with header x-kumud-cron every 15 minutes.
// Admin checks, with the same header: {"action":"subscribe"} links the Page to the app; {"action":"status"} counts.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type Obj = Record<string, any>;
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const env = (k: string) => (Deno.env.get(k) || "").trim();
const VER = "v23.0";
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
// Error text from Meta or Google may echo a link or token: keep logs to short, scrubbed messages.
const scrub = (s: unknown) => String(s ?? "").replace(/https?:\/\/\S+/g, "(link)").replace(/[A-Za-z0-9_-]{40,}/g, "(hidden)").slice(0, 160);

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const same = (a: string, b: string) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

/* ---------------- Meta ---------------- */
let pageToken = "";
async function graph(path: string, token: string, init?: RequestInit): Promise<Obj> {
  const sep = path.includes("?") ? "&" : "?";
  const r = await fetch(`https://graph.facebook.com/${VER}/${path}${sep}access_token=${encodeURIComponent(token)}`, init);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Meta ${r.status}: ${scrub(j?.error?.message || "error")}`);
  return j;
}
/** A Page token for the Kumud Page: KUMUD_TOKEN may already be one, or a System User token that can get it. */
async function kumudPageToken(): Promise<string> {
  if (pageToken) return pageToken;
  const t = env("KUMUD_TOKEN"), page = env("KUMUD_PAGE_ID");
  if (!t) throw new Error("KUMUD_TOKEN is not set");
  try { const p = await graph(`${page}?fields=access_token`, t); pageToken = p.access_token || t; } catch { pageToken = t; }
  return pageToken;
}
const formNames: Obj = {};
async function fetchLead(leadId: string): Promise<Obj> {
  const tok = await kumudPageToken();
  let lead: Obj;
  try { lead = await graph(`${leadId}?fields=id,created_time,field_data,form_id,page_id,ad_name,campaign_name,platform`, tok); }
  catch { lead = await graph(`${leadId}?fields=id,created_time,field_data,form_id,page_id,platform`, tok); } // ad names need ads_read
  if (lead.form_id && !formNames[lead.form_id]) { try { formNames[lead.form_id] = (await graph(`${lead.form_id}?fields=name`, tok)).name || ""; } catch { formNames[lead.form_id] = ""; } }
  return lead;
}

const STD = /^(full_name|name|first_name|last_name|phone_number|phone|mobile|mobile_number|email|email_address|work_email|city|state|province|zip|zip_code|post_code|postal_code|country|street_address|date_of_birth|gender|job_title|company_name|work_phone_number)$/;
/** Section 6 of the Kumud Order Desk guide. */
export function toOrderDesk(lead: Obj, formName: string): Obj {
  const a: Obj = {}; const extra: string[] = [];
  for (const f of lead.field_data || []) {
    const k = String(f.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const v = (f.values || []).map((x: unknown) => String(x ?? "").replace(/_/g, " ").trim()).filter(Boolean).join(", ");
    if (!v) continue;
    if (STD.test(k)) a[k] = a[k] || v; else extra.push(`${String(f.name).replace(/_/g, " ").replace(/\?$/, "")}: ${v}`);
  }
  const name = a.full_name || a.name || [a.first_name, a.last_name].filter(Boolean).join(" ");
  const p = String(lead.platform || "").toLowerCase();
  return {
    type: "lead", name, phone: a.phone_number || a.phone || a.mobile || a.mobile_number || a.work_phone_number || "",
    email: a.email || a.email_address || a.work_email || "", city: a.city || "",
    source: p === "ig" || p === "instagram" ? "ig" : p === "fb" || p === "facebook" ? "fb" : "Facebook",
    campaign: lead.campaign_name || "", adName: lead.ad_name || "", form: formName || "",
    interest: extra.length === 1 ? extra[0].replace(/^[^:]*:\s*/, "") : extra.join(" | "),
    leadgen_id: String(lead.id || ""),
  };
}

/* ---------------- Order Desk ---------------- */
/** POST the lead. Google answers 302 after saving: that counts as delivered; the redirect is then read for the reply. */
async function sendOrderDesk(body: Obj): Promise<{ status: string; http: number; reply: Obj }> {
  const url = env("KUMUD_ORDER_URL");
  if (!url) return { status: "failed", http: 0, reply: { error: "KUMUD_ORDER_URL is not set" } };
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), redirect: "manual" });
  let http = r.status, txt = "";
  if (http >= 300 && http < 400) {
    const loc = r.headers.get("location"); await r.body?.cancel();
    if (!loc) return { status: "delivered", http, reply: {} };
    try { const f = await fetch(loc); http = f.status; txt = await f.text(); } catch { return { status: "delivered", http, reply: {} }; }
    let j: Obj = {}; try { j = JSON.parse(txt); } catch { return { status: "delivered", http, reply: {} }; }
    return { status: j.ok === false ? "failed" : j.skipped ? "skipped" : "delivered", http, reply: j };
  }
  txt = await r.text();
  let j: Obj = {}; try { j = JSON.parse(txt); } catch { /* not JSON */ }
  if (!r.ok) return { status: "failed", http, reply: { error: scrub(j.error || `HTTP ${http}`) } };
  return { status: j.ok === false ? "failed" : j.skipped ? "skipped" : "delivered", http, reply: j };
}
/** Only non-personal parts of the reply go in the log. */
const safeReply = (j: Obj) => ({ ok: j.ok ?? null, lead: typeof j.lead === "string" ? j.lead.slice(0, 40) : undefined, repeat: j.repeat || undefined,
  skipped: j.skipped ? true : undefined, error: j.error ? scrub(j.error) : undefined });

async function processLead(leadId: string, formId: string, attempts: number): Promise<Obj> {
  let res: { status: string; http: number; reply: Obj };
  try {
    const lead = await fetchLead(leadId);
    if (env("KUMUD_PAGE_ID") && lead.page_id && String(lead.page_id) !== env("KUMUD_PAGE_ID")) res = { status: "ignored", http: 0, reply: { error: "not the Kumud Page" } };
    else { formId = String(lead.form_id || formId); res = await sendOrderDesk(toOrderDesk(lead, formNames[formId] || "")); }
  } catch (e) { res = { status: "failed", http: 0, reply: { error: scrub(e instanceof Error ? e.message : e) } }; }
  const reply = safeReply(res.reply);
  await admin.from("kumud_log").upsert({ leadgen_id: leadId, form_id: formId || null, status: res.status, http: res.http, reply, attempts: attempts + 1, updated_at: new Date().toISOString() }, { onConflict: "leadgen_id" });
  return { lead: leadId, status: res.status, orderDesk: reply };
}

async function cronOk(req: Request): Promise<boolean> {
  const t = req.headers.get("x-kumud-cron") || "";
  if (!t) return false;
  const { data } = await admin.from("kumud_config").select("value").eq("key", "cron_token").maybeSingle();
  return !!data?.value && same(String(data.value), t);
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  try {
    // Meta's one-time check when the webhook is added
    if (req.method === "GET") {
      const vt = env("KUMUD_VERIFY_TOKEN");
      if (url.searchParams.get("hub.mode") === "subscribe" && vt && same(url.searchParams.get("hub.verify_token") || "", vt))
        return new Response(url.searchParams.get("hub.challenge") || "", { status: 200 });
      return new Response("forbidden", { status: 403 });
    }
    if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
    const raw = await req.text();

    // Scheduler and admin checks
    if (req.headers.get("x-kumud-cron")) {
      if (!(await cronOk(req))) return json({ error: "forbidden" }, 403);
      const b = JSON.parse(raw || "{}");
      if (b.action === "status") {
        const { data } = await admin.from("kumud_log").select("status");
        const n: Obj = {}; for (const r of data || []) n[r.status] = (n[r.status] || 0) + 1;
        return json({ ok: true, secrets: { app_secret: !!env("KUMUD_APP_SECRET"), verify_token: !!env("KUMUD_VERIFY_TOKEN"), token: !!env("KUMUD_TOKEN"), page_id: !!env("KUMUD_PAGE_ID"), order_url: !!env("KUMUD_ORDER_URL") }, log: n });
      }
      if (b.action === "subscribe") {
        const page = env("KUMUD_PAGE_ID"); const tok = await kumudPageToken();
        const r = await graph(`${page}/subscribed_apps?subscribed_fields=leadgen`, tok, { method: "POST" });
        return json({ ok: !!r.success });
      }
      if (b.action === "retry") {
        const since = new Date(Date.now() - 30 * 864e5).toISOString();
        await admin.from("kumud_log").delete().lt("updated_at", since); // keep the technical log for 30 days
        const { data } = await admin.from("kumud_log").select("leadgen_id,form_id,attempts").eq("status", "failed").lt("attempts", 10).order("updated_at").limit(20);
        const out = []; for (const r of data || []) out.push(await processLead(r.leadgen_id, r.form_id || "", r.attempts || 0));
        return json({ ok: true, retried: out.length, results: out.map((x) => ({ lead: x.lead, status: x.status })) });
      }
      return json({ error: "unknown action" }, 400);
    }

    // Meta → new Kumud lead
    const secret = env("KUMUD_APP_SECRET");
    if (!secret) return new Response("not set up", { status: 403 });
    const sig = req.headers.get("x-hub-signature-256") || "";
    if (!same(sig, "sha256=" + await hmacHex(secret, raw))) return new Response("bad signature", { status: 403 });
    const p = JSON.parse(raw || "{}"); const results: Obj[] = [];
    for (const e of p.entry || []) for (const ch of e.changes || []) {
      if (ch.field !== "leadgen") continue;
      const v = ch.value || {};
      if (env("KUMUD_PAGE_ID") && String(v.page_id || e.id) !== env("KUMUD_PAGE_ID")) { results.push({ lead: String(v.leadgen_id || ""), status: "ignored" }); continue; }
      if (!v.leadgen_id) continue;
      const { data: prev } = await admin.from("kumud_log").select("status,attempts").eq("leadgen_id", String(v.leadgen_id)).maybeSingle();
      if (prev && prev.status !== "failed") { results.push({ lead: String(v.leadgen_id), status: "already " + prev.status }); continue; } // Meta sometimes repeats a webhook
      results.push(await processLead(String(v.leadgen_id), String(v.form_id || ""), prev?.attempts || 0));
    }
    // Always 200 so Meta keeps the webhook on; failures are retried by the scheduler.
    return json({ received: results.length, results });
  } catch (e) {
    console.error("kumud-webhook:", scrub(e instanceof Error ? e.message : e));
    return json({ error: "internal error" }, 500); // Meta retries the webhook later
  }
});
