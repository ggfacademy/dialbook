// Dialbook Pro – "leads-webhook" edge function (turn "Verify JWT" OFF)
// Receives new leads from:
//   • Facebook / Instagram lead ads (all connected Pages):  .../leads-webhook?fb=1
//   • Google Ads lead forms:                                 .../leads-webhook?s=<source id>   (key checked)
//   • Websites, IndiaMART, JustDial, Zapier, any form tool:   .../leads-webhook?s=<source id>&t=<token>
// The CRM shows each exact address in Settings → Lead sources.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
type Obj = Record<string, any>;
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type Mapped = { name: string; phone: string; email: string; city: string; language: string; note: string; extra: Obj };

/** Maps form answers (question → answer) to lead fields. Unknown questions go to notes. */
export function mapAnswers(pairs: Array<[string, string]>): Mapped {
  const m: Mapped = { name: "", phone: "", email: "", city: "", language: "", note: "", extra: {} };
  let first = "", last = "";
  for (const [rawKey, rawVal] of pairs) {
    const key = String(rawKey || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const val = String(rawVal ?? "").trim();
    if (!val) continue;
    if (["full_name", "name", "fullname", "customer_name", "sender_name", "your_name", "contact_name"].includes(key)) m.name = m.name || val;
    else if (key === "first_name") first = val;
    else if (key === "last_name") last = val;
    else if (/^(phone|phone_number|mobile|mobile_number|mobile_no|phone_no|contact|contact_number|whatsapp|whatsapp_number|sender_mobile|work_phone|work_phone_number)$/.test(key)) m.phone = m.phone || val;
    else if (/^(email|email_address|work_email|sender_email)$/.test(key)) m.email = m.email || val;
    else if (/^(city|sender_city|location|town|district)$/.test(key)) m.city = m.city || val;
    else if (key.includes("language") || key.includes("bhasha") || key === "lang") m.language = m.language || val;
    else m.extra[rawKey] = val;
  }
  if (!m.name && (first || last)) m.name = `${first} ${last}`.trim();
  m.note = Object.entries(m.extra).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join("\n");
  return m;
}

async function ingest(p: Obj) {
  const { data, error } = await admin.rpc("ingest_lead", { p });
  if (error) throw new Error(error.message);
  return data;
}
async function sourceError(id: string, msg: string) {
  await admin.from("lead_sources").update({ last_error: msg.slice(0, 300) }).eq("id", id);
}

/* ---------------- Facebook / Instagram lead ads ---------------- */
async function fbLead(fb: Obj, src: Obj, pageToken: string, v: Obj) {
  const ver = fb.api_version || "v23.0";
  const base = `https://graph.facebook.com/${ver}/${v.leadgen_id}`;
  let r = await fetch(`${base}?fields=id,created_time,field_data,form_id,ad_id,ad_name,adset_name,campaign_name,platform&access_token=${encodeURIComponent(pageToken)}`);
  let lead = await r.json();
  if (!r.ok) { // ad fields need extra permission; fall back to the basics
    r = await fetch(`${base}?fields=id,created_time,field_data,form_id&access_token=${encodeURIComponent(pageToken)}`);
    lead = await r.json();
    if (!r.ok) throw new Error(lead?.error?.message || `Facebook answered ${r.status}`);
  }
  const formId = String(lead.form_id || v.form_id || "");
  const cfg = src.config || {};
  const forms: Obj = cfg.forms || {};
  let formName = forms[formId]?.name || "";
  if (formId && !formName) {
    const fr = await fetch(`https://graph.facebook.com/${ver}/${formId}?fields=name&access_token=${encodeURIComponent(pageToken)}`);
    const fj = await fr.json().catch(() => ({}));
    formName = fj?.name || "";
    if (formName) { forms[formId] = { ...(forms[formId] || {}), name: formName }; await admin.from("lead_sources").update({ config: { ...cfg, forms } }).eq("id", src.id); }
  }
  const m = mapAnswers((lead.field_data || []).map((f: Obj) => [f.name, (f.values || []).join(", ")]));
  const fcfg = forms[formId] || {};
  const extra = { ...m.extra, form: formName, ad: lead.ad_name, campaign: lead.campaign_name, adset: lead.adset_name, platform: lead.platform };
  return ingest({
    name: m.name, phone: m.phone, email: m.email, city: m.city,
    language: m.language || fcfg.language || cfg.default_language || "",
    source: src.name, source_id: src.id, ref: `fb:${lead.id || v.leadgen_id}`,
    campaign_id: fcfg.campaign_id || cfg.campaign_id || null,
    tags: [formName, lead.platform === "ig" ? "Instagram" : ""].filter(Boolean),
    note: [lead.campaign_name ? `Ad campaign: ${lead.campaign_name}` : "", m.note].filter(Boolean).join("\n"), extra,
  });
}

async function handleFacebook(req: Request, url: URL): Promise<Response> {
  const { data: row } = await admin.from("integration_secrets").select("value").eq("key", "facebook").maybeSingle();
  const fb: Obj = row?.value || {};
  if (req.method === "GET") {
    if (url.searchParams.get("hub.mode") === "subscribe" && fb.verify_token && url.searchParams.get("hub.verify_token") === fb.verify_token) {
      return new Response(url.searchParams.get("hub.challenge") || "", { status: 200 });
    }
    return new Response("forbidden", { status: 403 });
  }
  const raw = await req.text();
  if (!fb.app_secret) return new Response("not set up", { status: 403 });
  const sig = req.headers.get("x-hub-signature-256") || "";
  if (sig !== "sha256=" + await hmacHex(fb.app_secret, raw)) return new Response("bad signature", { status: 403 });
  const p = JSON.parse(raw || "{}");
  for (const e of p.entry || []) for (const ch of e.changes || []) {
    if (ch.field !== "leadgen") continue;
    const v = ch.value || {};
    const { data: srcs } = await admin.from("lead_sources").select("*").eq("kind", "facebook").eq("active", true).filter("config->>page_id", "eq", String(v.page_id));
    const src = srcs?.[0];
    if (!src) continue;
    const { data: s } = await admin.from("lead_source_secrets").select("data").eq("source_id", src.id).maybeSingle();
    try { await fbLead(fb, src, s?.data?.page_token || "", v); }
    catch (err) { await sourceError(src.id, err instanceof Error ? err.message : String(err)); }
  }
  return json({ ok: true });
}

/* ---------------- Google Ads lead forms ---------------- */
async function handleGoogle(src: Obj, p: Obj): Promise<Response> {
  if (String(p.google_key || "") !== src.token) return json({ error: "Wrong key" }, 403);
  const cols: Obj[] = p.user_column_data || [];
  const pairs: Array<[string, string]> = cols.map((c) => {
    const id = String(c.column_id || "");
    const known = /^(FULL_NAME|FIRST_NAME|LAST_NAME|PHONE_NUMBER|EMAIL|CITY|WORK_EMAIL|WORK_PHONE|WORK_PHONE_NUMBER)$/.test(id);
    return [known ? id.toLowerCase() : (c.column_name || id), String(c.string_value ?? "")];
  });
  const m = mapAnswers(pairs);
  const cfg = src.config || {};
  const r = await ingest({
    name: m.name, phone: m.phone, email: m.email, city: m.city,
    language: m.language || cfg.default_language || "",
    source: src.name, source_id: src.id, ref: `google:${p.lead_id}`,
    campaign_id: cfg.campaign_id || null, tags: ["Google Ads"],
    note: m.note, extra: { ...m.extra, google_campaign_id: p.campaign_id, form_id: p.form_id, gclid: p.gcl_id }, test: !!p.is_test,
  });
  return json(r?.status === "skipped" ? { error: "No phone or email in the lead" } : {}, 200);
}

/* ---------------- Websites and other tools ---------------- */
function flatten(o: Obj): Obj {
  // IndiaMART-style { RESPONSE: {...} } or { data: {...} } wrappers
  for (const k of ["RESPONSE", "response", "data", "lead", "payload"]) if (o && typeof o[k] === "object" && !Array.isArray(o[k])) return { ...o, ...o[k] };
  return o;
}
async function handleGeneric(src: Obj, p: Obj): Promise<Response> {
  const o = flatten(p);
  const cfg = src.config || {};
  const fm: Obj = cfg.field_map || {};
  const pairs: Array<[string, string]> = Object.entries(o).filter(([, v]) => typeof v !== "object").map(([k, v]) => [fm[k] || k, String(v)]);
  const m = mapAnswers(pairs);
  const noteKeys = ["message", "comments", "comment", "query", "query_message", "requirement", "remarks", "subject", "enquiry", "query_product_name", "product"];
  const refKey = Object.keys(o).find((k) => ["unique_query_id", "query_id", "lead_id", "id", "enquiry_id"].includes(k.toLowerCase()));
  const note = m.note || Object.entries(o).filter(([k]) => noteKeys.includes(k.toLowerCase())).map(([, v]) => String(v)).join("\n");
  const r = await ingest({
    name: m.name, phone: m.phone, email: m.email, city: m.city,
    language: m.language || cfg.default_language || "",
    source: src.name, source_id: src.id, ref: refKey ? `${src.id}:${o[refKey]}` : null,
    campaign_id: cfg.campaign_id || null, tags: [], note, extra: m.extra,
  });
  return json({ ok: true, status: r?.status, lead_id: r?.lead_id });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  try {
    if (url.searchParams.get("fb")) return await handleFacebook(req, url);
    const id = url.searchParams.get("s") || "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Unknown source" }, 404);
    const { data: src } = await admin.from("lead_sources").select("*").eq("id", id).maybeSingle();
    if (!src || !src.active) return json({ error: "Unknown or paused source" }, 404);
    if (req.method !== "POST") return json({ ok: true, message: "Send leads here with POST." });
    const raw = await req.text();
    const ct = req.headers.get("content-type") || "";
    let p: Obj;
    try { p = ct.includes("application/x-www-form-urlencoded") ? Object.fromEntries(new URLSearchParams(raw)) : JSON.parse(raw || "{}"); }
    catch { return json({ error: "Send JSON or form data" }, 400); }
    if (src.kind === "google") return await handleGoogle(src, p);
    if (url.searchParams.get("t") !== src.token && req.headers.get("x-api-key") !== src.token) return json({ error: "Wrong token" }, 403);
    return await handleGeneric(src, p);
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
