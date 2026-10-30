-- Dialbook Pro – Kumud Gemstones lead forwarding (supabase/functions/kumud-webhook). Separate from training.
-- Run once in Supabase → SQL Editor. Safe to run again.
--
-- Kumud leads are not stored. kumud_log keeps only technical facts for retries (Meta lead id, form id, status,
-- attempts, HTTP code and the Order Desk's ok / internal id / error), for 30 days. Neither table has any access
-- policy, so no Dialbook login (telecaller, manager or admin) can read or change them through the website, the
-- phone app or the API. Only the kumud-webhook function (service role) and the Supabase dashboard can.

create table if not exists public.kumud_log (
  leadgen_id text primary key,
  form_id text,
  status text not null default 'failed',      -- delivered | skipped | failed | ignored
  http int,
  reply jsonb not null default '{}'::jsonb,   -- {ok, lead, repeat, skipped, error} from the Order Desk, nothing personal
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists kumud_log_retry on public.kumud_log(status, updated_at);

create table if not exists public.kumud_config (key text primary key, value text not null);

alter table public.kumud_log enable row level security;
alter table public.kumud_config enable row level security;
revoke all on public.kumud_log, public.kumud_config from anon, authenticated, public;

-- The scheduler's password, checked by kumud-webhook (separate from the training scheduler's password)
insert into public.kumud_config(key, value)
values ('cron_token', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

-- Every 15 minutes: retry Kumud leads that could not be delivered, and drop log lines older than 30 days
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule(jobid) from cron.job where jobname = 'kumud-retry';
select cron.schedule('kumud-retry', '*/15 * * * *', $cron$
  select net.http_post(
    url := 'https://yyrovakknsuanlolrlth.supabase.co/functions/v1/kumud-webhook',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-kumud-cron', (select value from public.kumud_config where key = 'cron_token')),
    body := '{"action":"retry"}'::jsonb)
$cron$);

-- Admin checks (run here when needed; they show counts only, no customer details):
--   Link the Kumud Page to the Kumud app (once, after the secrets are saved):
--     select net.http_post(url := 'https://yyrovakknsuanlolrlth.supabase.co/functions/v1/kumud-webhook',
--       headers := jsonb_build_object('Content-Type','application/json','x-kumud-cron',(select value from public.kumud_config where key='cron_token')),
--       body := '{"action":"subscribe"}'::jsonb);
--   Then read the answer:  select status_code, content from net._http_response order by id desc limit 1;
--   Delivery log:          select leadgen_id, status, http, reply, attempts, updated_at from public.kumud_log order by updated_at desc limit 20;
