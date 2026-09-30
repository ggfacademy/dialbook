// Dialbook Pro – "ai-webhook" edge function
// Bolna sends call results here. Set the agent's webhook URL in Bolna to:
//   https://<project>.supabase.co/functions/v1/ai-webhook?token=<WEBHOOK_SECRET>
// Turn OFF "Verify JWT" for this function (Bolna cannot sign in).
//
// Secrets: WEBHOOK_SECRET (required), ANTHROPIC_API_KEY + ANTHROPIC_MODEL (optional, smarter outcomes)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const ok = (msg = "ok") => new Response(JSON.stringify({ ok: true, msg }), { headers: { "Content-Type": "application/json" } });

const TERMINAL = ["completed", "no-answer", "busy", "failed", "canceled", "cancelled", "stopped", "error", "balance-low", "call-disconnected"];

type Dispo = { id: string; name: string; connected?: boolean; stage?: string; fu?: boolean };

function tomorrow11IST(days = 1): string {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 3600e3);
  ist.setUTCDate(ist.getUTCDate() + days);
  ist.setUTCHours(11, 0, 0, 0);
  return new Date(ist.getTime() - 5.5 * 3600e3).toISOString();
}

async function classifyWithClaude(dispos: Dispo[], p: Record<string, unknown>): Promise<{ outcome: string; followUpDays: number | null; summary: string } | null> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return null;
  const prompt = `You label the result of a sales phone call made by an AI voice agent for an Indian business.
Pick exactly one outcome id from this list:
${dispos.map((d) => `- ${d.id}: ${d.name}`).join("\n")}

Transcript:
${String(p.transcript || "").slice(0, 6000)}

Provider summary: ${p.summary || "none"}
Extracted data: ${JSON.stringify(p.extracted_data || {}).slice(0, 1500)}

Answer with only JSON, no other text:
{"outcome":"<id>","follow_up_days":<number of days until the next call, or null if none needed>,"summary":"<one or two sentences in English for the sales team>"}`;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-4-5", max_tokens: 300, messages: [{ role: "user", content: prompt }] }),
    });
    const j = await r.json();
    const text = (j.content || []).map((c: { text?: string }) => c.text || "").join("");
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const o = JSON.parse(m[0]);
    if (!dispos.some((d) => d.id === o.outcome)) return null;
    return { outcome: o.outcome, followUpDays: typeof o.follow_up_days === "number" ? o.follow_up_days : null, summary: String(o.summary || "") };
  } catch {
    return null;
  }
}

function classifyByRules(dispos: Dispo[], p: Record<string, unknown>, talked: boolean): string {
  const has = (id: string) => dispos.some((d) => d.id === id);
  const pick = (...ids: string[]) => ids.find(has) || dispos[0]?.id || "no_answer";
  const status = String(p.status || "");
  if (status === "busy") return pick("busy", "no_answer");
  if (["failed", "error", "canceled", "cancelled"].includes(status)) return pick("unreachable", "no_answer");
  if (!talked || p.answered_by_voice_mail) return pick("no_answer");
  const text = `${p.smart_status || ""} ${p.summary || ""} ${JSON.stringify(p.extracted_data || {})}`.toLowerCase();
  if (/not interested|no interest|don't call|do not call|stop calling/.test(text)) return pick("not_interested");
  if (/wrong number/.test(text)) return pick("wrong_number");
  if (/call ?back|later|busy right now|another time/.test(text)) return pick("callback");
  if (/interested|yes|send details|share details|brochure|visit/.test(text)) return pick("interested", "info_shared");
  return pick("info_shared", "callback");
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const secret = Deno.env.get("WEBHOOK_SECRET");
  if (!secret || url.searchParams.get("token") !== secret) return new Response("forbidden", { status: 403 });
  if (req.method !== "POST") return ok("ready");

  let p: Record<string, unknown>;
  try { p = await req.json(); } catch { return ok("no body"); }
  const execId = String(p.id || p.execution_id || "");
  if (!execId) return ok("no id");

  const { data: ac } = await admin.from("ai_calls").select("*").eq("execution_id", execId).maybeSingle();
  if (!ac) return ok("unknown call");

  const status = String(p.status || "unknown");
  await admin.from("ai_calls").update({ status, raw: p, updated_at: new Date().toISOString() }).eq("id", ac.id);
  if (!TERMINAL.includes(status) || ac.call_id) return ok("stored");

  const { data: st } = await admin.from("settings").select("data").eq("id", 1).single();
  const dispos: Dispo[] = st?.data?.dispositions || [];
  const tel = (p.telephony_data || {}) as Record<string, unknown>;
  const duration = Math.round(Number(p.conversation_duration ?? tel.duration ?? 0)) || 0;
  const userSpoke = /(^|\n)\s*user\s*:/i.test(String(p.transcript || ""));
  const talked = status === "completed" && duration > 0 && userSpoke;

  let outcome = classifyByRules(dispos, p, talked);
  let summary = String(p.summary || "");
  let fuDays: number | null = null;
  if (talked) {
    const c = await classifyWithClaude(dispos, p);
    if (c) { outcome = c.outcome; summary = c.summary || summary; fuDays = c.followUpDays; }
  }
  const d = dispos.find((x) => x.id === outcome);
  let followUp: string | null = null;
  if (fuDays !== null && fuDays >= 0) followUp = tomorrow11IST(Math.max(1, Math.round(fuDays)));
  else if (d?.fu) followUp = talked ? tomorrow11IST(1) : new Date(Date.now() + 3 * 3600e3).toISOString();

  const { data: call } = await admin.from("calls").upsert({
    lead_id: ac.lead_id,
    agent_id: null,
    source: "ai",
    direction: "outgoing",
    started_at: String(p.initiated_at || p.created_at || new Date().toISOString()),
    duration,
    connected: talked,
    outcome,
    note: summary ? `AI: ${summary}` : "AI call",
    follow_up_at: followUp,
    recording_url: (tel.recording_url as string) || null,
    transcript: (p.transcript as string) || null,
    external_id: `ai:${execId}`,
    ai_call_id: ac.id,
  }, { onConflict: "external_id", ignoreDuplicates: true }).select("id").maybeSingle();

  await admin.from("ai_calls").update(call?.id ? { call_id: call.id, outcome, summary } : { outcome, summary }).eq("id", ac.id);
  return ok("logged");
});
