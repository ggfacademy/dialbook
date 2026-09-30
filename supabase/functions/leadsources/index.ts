// Dialbook Pro – "leadsources" edge function (keep "Verify JWT" ON). Admins only.
// Actions:
//   status                         → Facebook setup state and webhook addresses
//   fb_setup    { app_secret?, user_token?, api_version? }
//   fb_pages                       → every Facebook Page the token can manage
//   fb_connect  { page_ids: [] }   → subscribe Pages to lead ads and add them as sources
//   fb_forms    { source_id }      → lead forms on that Page
//   fb_fetch    { source_id, days } → pull recent leads (catch-up)
//   source_save { id?, kind, name, active, config }
//   source_delete { id }
//   test_lead   { source_id }      → creates a test lead through the assignment rules

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(SB_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const HOOK = `${SB_URL}/functions/v1/leads-webhook`;
type Obj = Record<string, any>;
class UserError extends Error {}

async function fbConfig(): Promise<Obj> {
  const { data } = await admin.from("integration_secrets").select("value").eq("key", "facebook").maybeSingle();
  return data?.value || {};
}
async function graph(path: string, token: string, ver: string, method = "GET"): Promise<Obj> {
  const sep = path.includes("?") ? "&" : "?";
  const r = await fetch(`https://graph.facebook.com/${ver}/${path}${sep}access_token=${encodeURIComponent(token)}`, { method });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new UserError(j?.error?.message || `Facebook answered ${r.status}`);
  return j;
}
async function allPages(fb: Obj): Promise<Obj[]> {
  if (!fb.user_token) throw new UserError("Add your Facebook access token first.");
  const out: Obj[] = [];
  let next: string | null = `https://graph.facebook.com/${fb.api_version || "v23.0"}/me/accounts?fields=id,name,category,access_token,tasks&limit=100&access_token=${encodeURIComponent(fb.user_token)}`;
  while (next) {
    const r: Response = await fetch(next);
    const j = await r.json();
    if (!r.ok) throw new UserError(j?.error?.message || "Facebook did not return your Pages");
    out.push(...(j.data || []));
    next = j?.paging?.next || null;
  }
  return out;
}

/* Same mapping as leads-webhook (kept here so each function is one file). */
function mapAnswers(pairs: Array<[string, string]>) {
  const m = { name: "", phone: "", email: "", city: "", language: "", note: "", extra: {} as Obj };
  let first = "", last = "";
  for (const [rawKey, rawVal] of pairs) {
    const key = String(rawKey || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const val = String(rawVal ?? "").trim();
    if (!val) continue;
    if (["full_name", "name", "fullname", "customer_name", "your_name"].includes(key)) m.name = m.name || val;
    else if (key === "first_name") first = val;
    else if (key === "last_name") last = val;
    else if (/^(phone|phone_number|mobile|mobile_number|contact_number|whatsapp|whatsapp_number)$/.test(key)) m.phone = m.phone || val;
    else if (/^(email|email_address|work_email)$/.test(key)) m.email = m.email || val;
    else if (/^(city|location|town|district)$/.test(key)) m.city = m.city || val;
    else if (key.includes("language") || key.includes("bhasha")) m.language = m.language || val;
    else m.extra[rawKey] = val;
  }
  if (!m.name && (first || last)) m.name = `${first} ${last}`.trim();
  m.note = Object.entries(m.extra).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join("\n");
  return m;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const userClient = createClient(SB_URL, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Please sign in again." }, 401);
    const { data: me } = await admin.from("profiles").select("*").eq("id", user.id).single();
    if (!me?.active || me.role !== "admin") return json({ error: "Only admins can manage lead sources." }, 403);
    const b: Obj = await req.json();
    const fb = await fbConfig();
    const ver = fb.api_version || "v23.0";

    switch (b.action) {
      case "status":
        return json({
          facebook: { configured: !!(fb.app_secret && fb.user_token), has_secret: !!fb.app_secret, has_token: !!fb.user_token, api_version: ver,
            verify_token: fb.verify_token || "", webhook_url: `${HOOK}?fb=1`, account: fb.account_name || "" },
          webhook_base: HOOK,
        });

      case "fb_setup": {
        const v: Obj = { ...fb };
        if (b.app_secret) v.app_secret = String(b.app_secret).trim();
        if (b.api_version) v.api_version = String(b.api_version).trim();
        if (!v.verify_token) v.verify_token = crypto.randomUUID().replace(/-/g, "");
        if (b.user_token) {
          const token = String(b.user_token).trim();
          const who = await graph("me?fields=id,name", token, v.api_version || "v23.0");
          v.user_token = token; v.account_name = who.name || "";
        }
        await admin.from("integration_secrets").upsert({ key: "facebook", value: v });
        return json({ ok: true, account: v.account_name || "", verify_token: v.verify_token, webhook_url: `${HOOK}?fb=1` });
      }

      case "fb_pages": {
        const pages = await allPages(fb);
        const { data: srcs } = await admin.from("lead_sources").select("config").eq("kind", "facebook");
        const connected = new Set((srcs || []).map((s: Obj) => String(s.config?.page_id)));
        return json({ pages: pages.map((p) => ({ id: p.id, name: p.name, category: p.category, connected: connected.has(String(p.id)),
          can_advertise: !p.tasks || p.tasks.includes("ADVERTISE") })) });
      }

      case "fb_connect": {
        const want = new Set((b.page_ids || []).map(String));
        const pages = (await allPages(fb)).filter((p) => want.has(String(p.id)));
        const results: Obj[] = [];
        for (const p of pages) {
          try {
            await graph(`${p.id}/subscribed_apps?subscribed_fields=leadgen`, p.access_token, ver, "POST");
            const { data: existing } = await admin.from("lead_sources").select("id,config").eq("kind", "facebook").filter("config->>page_id", "eq", String(p.id)).maybeSingle();
            let id = existing?.id;
            if (!id) {
              const { data, error } = await admin.from("lead_sources").insert({ kind: "facebook", name: `Facebook – ${p.name}`, config: { page_id: String(p.id), page_name: p.name, default_language: "", campaign_id: "", forms: {} } }).select("id").single();
              if (error) throw new Error(error.message);
              id = data.id;
            } else {
              await admin.from("lead_sources").update({ active: true, last_error: null }).eq("id", id);
            }
            await admin.from("lead_source_secrets").upsert({ source_id: id, data: { page_token: p.access_token } });
            results.push({ page: p.name, ok: true });
          } catch (e) {
            results.push({ page: p.name, ok: false, error: e instanceof Error ? e.message : String(e) });
          }
        }
        return json({ results });
      }

      case "fb_forms": {
        const { data: src } = await admin.from("lead_sources").select("*").eq("id", b.source_id).single();
        const { data: s } = await admin.from("lead_source_secrets").select("data").eq("source_id", src.id).maybeSingle();
        const j = await graph(`${src.config.page_id}/leadgen_forms?fields=id,name,status,locale&limit=200`, s?.data?.page_token || "", ver);
        return json({ forms: j.data || [] });
      }

      case "fb_fetch": {
        const { data: src } = await admin.from("lead_sources").select("*").eq("id", b.source_id).single();
        const { data: s } = await admin.from("lead_source_secrets").select("data").eq("source_id", src.id).maybeSingle();
        const token = s?.data?.page_token || "";
        const since = Math.floor(Date.now() / 1000) - Math.min(90, Math.max(1, Number(b.days) || 7)) * 86400;
        const forms = (await graph(`${src.config.page_id}/leadgen_forms?fields=id,name&limit=200`, token, ver)).data || [];
        const counts: Obj = { created: 0, existing: 0, duplicate: 0, skipped: 0 };
        const cfg = src.config || {};
        for (const f of forms) {
          const filtering = encodeURIComponent(JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: since }]));
          let next: string | null = `https://graph.facebook.com/${ver}/${f.id}/leads?fields=id,created_time,field_data,ad_name,campaign_name,platform&limit=100&filtering=${filtering}&access_token=${encodeURIComponent(token)}`;
          while (next) {
            const r: Response = await fetch(next);
            const j = await r.json();
            if (!r.ok) throw new UserError(`${f.name}: ${j?.error?.message || "could not read leads"}`);
            for (const lead of j.data || []) {
              const m = mapAnswers((lead.field_data || []).map((x: Obj) => [x.name, (x.values || []).join(", ")]));
              const fc = cfg.forms?.[f.id] || {};
              const { data: res, error } = await admin.rpc("ingest_lead", { p: {
                name: m.name, phone: m.phone, email: m.email, city: m.city,
                language: m.language || fc.language || cfg.default_language || "",
                source: src.name, source_id: src.id, ref: `fb:${lead.id}`, campaign_id: fc.campaign_id || cfg.campaign_id || null,
                tags: [f.name, lead.platform === "ig" ? "Instagram" : ""].filter(Boolean),
                note: [lead.campaign_name ? `Ad campaign: ${lead.campaign_name}` : "", m.note].filter(Boolean).join("\n"),
                extra: { ...m.extra, form: f.name, ad: lead.ad_name, campaign: lead.campaign_name } } });
              if (error) throw new Error(error.message);
              counts[res?.status || "skipped"] = (counts[res?.status || "skipped"] || 0) + 1;
            }
            next = j?.paging?.next || null;
          }
        }
        return json(counts);
      }

      case "source_save": {
        const kind = String(b.kind || "");
        if (!["facebook", "google", "webhook"].includes(kind)) throw new UserError("Unknown source type.");
        const row: Obj = { name: String(b.name || "").trim() || (kind === "google" ? "Google Ads" : "Website"), active: b.active !== false };
        if (b.id) {
          const { data: old } = await admin.from("lead_sources").select("config").eq("id", b.id).single();
          row.config = { ...(old?.config || {}), ...(b.config || {}) };
          const { data, error } = await admin.from("lead_sources").update(row).eq("id", b.id).select("*").single();
          if (error) throw new Error(error.message);
          return json({ source: data });
        }
        if (kind === "facebook") throw new UserError("Add Facebook Pages with “Add Pages”.");
        const { data, error } = await admin.from("lead_sources").insert({ ...row, kind, config: b.config || {} }).select("*").single();
        if (error) throw new Error(error.message);
        return json({ source: data });
      }

      case "source_delete": {
        const { data: src } = await admin.from("lead_sources").select("*").eq("id", b.id).single();
        if (src?.kind === "facebook") {
          const { data: s } = await admin.from("lead_source_secrets").select("data").eq("source_id", src.id).maybeSingle();
          try { await graph(`${src.config.page_id}/subscribed_apps`, s?.data?.page_token || "", ver, "DELETE"); } catch { /* already removed */ }
        }
        await admin.from("lead_sources").delete().eq("id", b.id);
        return json({ ok: true });
      }

      case "test_lead": {
        const { data: src } = await admin.from("lead_sources").select("*").eq("id", b.source_id).single();
        const phone = "+9199" + String(Math.floor(10000000 + Math.random() * 89999999));
        const { data: res, error } = await admin.rpc("ingest_lead", { p: {
          name: "Test lead " + new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }), phone,
          language: b.language || src.config?.default_language || "", source: src.name, source_id: src.id,
          campaign_id: src.config?.campaign_id || null, test: true, note: "Created with the Test button in Settings → Lead sources." } });
        if (error) throw new Error(error.message);
        const { data: who } = res?.assigned_to ? await admin.from("profiles").select("name").eq("id", res.assigned_to).single() : { data: null };
        return json({ ...res, assigned_name: who?.name || "" });
      }
    }
    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    if (e instanceof UserError) return json({ error: e.message }, 400);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
