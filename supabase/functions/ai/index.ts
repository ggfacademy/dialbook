// Dialbook Pro – "ai" edge function
// Actions:
//   { action: "call", lead_ids?: string[], filter?: { campaign?: string, queue?: "fresh"|"due"|"open" }, limit?: number }
//      Places AI voice calls through Bolna for the chosen leads.
//   { action: "assist", lead_id: string }
//      Reads a lead's history and suggests the next step (needs ANTHROPIC_API_KEY).
//
// Secrets (Supabase → Edge Functions → Secrets):
//   BOLNA_API_KEY        required for AI calls
//   ANTHROPIC_API_KEY    optional, for "Suggest next step" and smarter call outcomes
//   ANTHROPIC_MODEL      optional, defaults to claude-sonnet-4-5
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

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

function e164(p: string): string {
  let d = String(p || "").replace(/[^\d+]/g, "");
  if (d.startsWith("+")) return d;
  d = d.replace(/^0+/, "");
  if (d.length === 10) return "+91" + d;
  if (d.length === 12 && d.startsWith("91")) return "+" + d;
  return "+" + d;
}

function istHour(): number {
  const s = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false });
  return parseInt(s, 10) % 24;
}

export async function askClaude(prompt: string, maxTokens = 600): Promise<string> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("Add ANTHROPIC_API_KEY in Supabase Edge Function secrets to use AI suggestions.");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-4-5",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || "AI request failed");
  return (j.content || []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const userClient = createClient(SB_URL, ANON, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Please sign in again." }, 401);

    const admin = createClient(SB_URL, SERVICE);
    const { data: me } = await admin.from("profiles").select("*").eq("id", user.id).single();
    if (!me?.active) return json({ error: "Your account is not approved yet." }, 403);
    const isMgr = me.role === "admin" || me.role === "manager";

    const body = await req.json();
    const { data: st } = await admin.from("settings").select("data").eq("id", 1).single();
    const cfg = st?.data || {};

    /* ---------------- assist ---------------- */
    if (body.action === "assist") {
      const { data: lead } = await admin.from("leads").select("*").eq("id", body.lead_id).single();
      if (!lead) return json({ error: "Lead not found" }, 404);
      if (!isMgr && lead.assigned_to !== me.id) return json({ error: "Not your lead" }, 403);
      const { data: calls } = await admin.from("calls").select("started_at,source,duration,outcome,note,transcript")
        .eq("lead_id", lead.id).order("started_at", { ascending: false }).limit(12);
      const { data: acts } = await admin.from("activities").select("created_at,kind,text,data")
        .eq("lead_id", lead.id).order("created_at", { ascending: false }).limit(10);
      const dname = (id: string) => (cfg.dispositions || []).find((d: { id: string }) => d.id === id)?.name || id || "no outcome";
      const hist = [
        ...(calls || []).map((c: Record<string, unknown>) =>
          `${c.started_at}: ${c.source} call, ${c.duration}s, ${dname(c.outcome as string)}${c.note ? " – " + c.note : ""}${c.transcript ? "\nTranscript excerpt: " + String(c.transcript).slice(0, 800) : ""}`),
        ...(acts || []).map((a: Record<string, unknown>) => `${a.created_at}: ${a.kind} ${a.text || JSON.stringify(a.data)}`),
      ].join("\n");
      const text = await askClaude(`You help an Indian telecalling sales team at ${cfg.company || "our company"}.
Lead: ${lead.name}, city ${lead.city || "?"}, source ${lead.source || "?"}, stage ${lead.stage}, priority ${lead.priority || "not set"}.
Notes: ${lead.note || "none"}
History (newest first):
${hist || "No activity yet."}
Now: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST.
Reply in plain text under 140 words with three labelled parts:
Summary: one or two lines.
Next step: what the caller should do and when.
WhatsApp message: a short friendly message the caller (${me.name}) can send. Use Hinglish if the notes are in Hindi or Hinglish.`);
      return json({ text });
    }

    /* ---------------- call ---------------- */
    if (body.action === "call") {
      const key = Deno.env.get("BOLNA_API_KEY");
      const ai = cfg.ai || {};
      if (ai.enabled === false) return json({ error: "AI calling is switched off. An admin can turn it on in AI calling or Settings." }, 400);
      if (!key) return json({ error: "Add BOLNA_API_KEY in Supabase Edge Function secrets first." }, 400);
      const langAgents: Record<string, string> = ai.agents || {};
      if (!ai.agentId && !Object.values(langAgents).some(Boolean)) return json({ error: "Add a Bolna agent ID in Settings → AI calling first." }, 400);
      const h = istHour();
      const startH = Number(ai.startHour ?? 10), endH = Number(ai.endHour ?? 19);
      if (h < startH || h >= endH) return json({ error: `AI calls are only allowed between ${startH}:00 and ${endH}:00 IST. Change this in Settings.` }, 400);

      const max = Math.max(1, Math.min(Number(body.limit) || 1, Number(ai.maxBatch) || 50, 200));
      let q = admin.from("leads").select("*").not("stage", "in", "(won,lost)").eq("dnd", false);
      if (Array.isArray(body.lead_ids) && body.lead_ids.length) {
        q = q.in("id", body.lead_ids.slice(0, max));
      } else {
        if (!isMgr) return json({ error: "Only managers can start AI calling lists." }, 403);
        q = q.eq("contact_only", false); // the contact list (old data) is for messages only
        const f = body.filter || {};
        if (f.campaign) q = q.eq("campaign_id", f.campaign);
        const endToday = new Date(); endToday.setUTCHours(18, 30, 0, 0); // 00:00 IST next day
        if (endToday.getTime() < Date.now()) endToday.setUTCDate(endToday.getUTCDate() + 1);
        if (f.queue === "fresh") q = q.eq("call_count", 0);
        else if (f.queue === "due") q = q.lt("next_follow_up_at", endToday.toISOString());
        q = q.order("priority_rank").order("created_at").limit(max);
      }
      const { data: leads, error } = await q;
      if (error) return json({ error: error.message }, 400);
      const mine = (leads || []).filter((l: Record<string, unknown>) => isMgr || l.assigned_to === me.id);

      const { data: camps } = await admin.from("campaigns").select("id,name,ai_agent_id");
      const campOf = (id: string) => (camps || []).find((c: { id: string }) => c.id === id);
      let queued = 0; const errors: string[] = [];
      for (const l of mine) {
        const c = campOf(l.campaign_id);
        // Agent choice: the lead's language agent (e.g. Tamil) → the campaign's agent → the default agent.
        const agentId = langAgents[l.language || ""] || c?.ai_agent_id || ai.agentId;
        if (!agentId) { errors.push(`${l.name || l.phone}: no AI agent for ${l.language || "this lead"}'s language`); continue; }
        const payload: Record<string, unknown> = {
          agent_id: agentId,
          recipient_phone_number: e164(l.phone),
          user_data: {
            lead_id: l.id, lead_name: l.name || "", first_name: (l.name || "").split(" ")[0] || "",
            city: l.city || "", company_name: cfg.company || "", campaign: c?.name || "", notes: l.note || "", language: l.language || "",
          },
        };
        if (ai.fromNumber) payload.from_phone_number = ai.fromNumber;
        try {
          const r = await fetch("https://api.bolna.ai/call", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const j = await r.json().catch(() => ({}));
          if (!r.ok || !j.execution_id) throw new Error(j?.message || j?.detail || `Bolna answered ${r.status}`);
          await admin.from("ai_calls").insert({ lead_id: l.id, execution_id: j.execution_id, status: j.status || "queued", requested_by: me.id });
          await admin.from("activities").insert({ lead_id: l.id, actor_id: me.id, kind: "ai", text: "AI call started" });
          queued++;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          errors.push(`${l.name || l.phone}: ${msg}`);
          await admin.from("ai_calls").insert({ lead_id: l.id, status: "failed", requested_by: me.id, error: msg });
        }
        await new Promise((res) => setTimeout(res, 250));
      }
      return json({ queued, skipped: (leads || []).length - mine.length, errors });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
