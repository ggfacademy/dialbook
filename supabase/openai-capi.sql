-- Dialbook Pro – ChatGPT Ads Conversions API: report enquiries from the ChatGPT ad page to OpenAI (server side).
-- Run once in Supabase → SQL Editor. Safe to run again.
--
-- When an enquiry from the Vijayawada enquiry page (lead source "CHATGPT") is saved as a NEW lead in Dialbook, a
-- `lead_created` event is sent to https://bzr.openai.com/v1/events?pid=<Pixel ID> within about 2 minutes.
--   • Event id = "dialbook_lead_<Dialbook lead ID>", so a retry or resend is never counted twice by OpenAI.
--   • A refresh sends nothing; a second submission with the same mobile number updates the existing lead and sends nothing.
--   • Sent: event type, time, the ad's click reference (`oppref`, from the ad link) and the page address.
--     No name, phone number, email or city is sent.
--   • The API key is kept in Supabase Vault (encrypted), never in the website or GitHub. Every answer from OpenAI
--     is logged in public.openai_capi_events (only admins can see the summary in Settings → Lead sources).
--
-- After running this file, the owner runs these two lines ONCE in the SQL Editor with the real values from
-- ChatGPT Ads Manager → Conversions ("My first pixel"):
--   select vault.create_secret('PASTE-THE-API-KEY-HERE', 'openai_capi_key', 'ChatGPT Ads Conversions API key');
--   update public.openai_capi_config set pixel_id = 'PASTE-THE-PIXEL-ID-HERE' where id = 1;
-- To replace the key later:
--   select vault.update_secret((select id from vault.secrets where name = 'openai_capi_key'), 'NEW-KEY');

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.openai_capi_config (
  id int primary key default 1 check (id = 1),
  pixel_id text not null default '',
  source_id uuid,                                  -- the Dialbook lead source whose new leads are reported
  enabled boolean not null default true,
  validate_only boolean not null default false,    -- true = OpenAI only checks the events, nothing is recorded
  last_ok timestamptz,
  last_error text
);
insert into public.openai_capi_config(id, source_id)
select 1, (select id from public.lead_sources where name = 'CHATGPT' order by created_at limit 1)
on conflict (id) do nothing;
alter table public.openai_capi_config enable row level security;     -- no policies: only the functions below
revoke all on public.openai_capi_config from anon, authenticated, public;

create table if not exists public.openai_capi_events (
  id bigserial primary key,
  lead_id uuid references public.leads(id) on delete set null,
  event_id text not null unique,
  event jsonb not null,
  created_at timestamptz not null default now(),
  status text not null default 'queued',           -- queued → sending → sent | error | expired
  request_id bigint,
  sending_at timestamptz,
  sent_at timestamptz,
  response_code int,
  response text
);
create index if not exists openai_capi_events_status on public.openai_capi_events(status);
alter table public.openai_capi_events enable row level security;
revoke all on public.openai_capi_events from anon, authenticated, public;

-- a NEW lead from the ChatGPT enquiry page → queue lead_created
create or replace function public.openai_capi_on_lead() returns trigger
language plpgsql security definer set search_path = public as $$
declare c public.openai_capi_config; ev jsonb; opp text; url text;
begin
  select * into c from public.openai_capi_config where id = 1;
  if not found or c.source_id is null or new.source_id is distinct from c.source_id then return new; end if;
  if 'Test lead' = any(coalesce(new.tags, '{}')) then return new; end if;
  opp := nullif(left(btrim(coalesce(new.extra->>'oppref', '')), 500), '');
  url := coalesce(nullif(new.extra->>'page', ''), 'https://ggfacademy.github.io/dialbook/enquiry/vijayawada.html');
  if url !~ '^https?://[^/]+' then url := 'https://ggfacademy.github.io/dialbook/enquiry/vijayawada.html'; end if;
  ev := jsonb_build_object(
    'id', 'dialbook_lead_' || new.id,
    'type', 'lead_created',
    'timestamp_ms', (extract(epoch from new.created_at) * 1000)::bigint,
    'source_url', url,
    'action_source', 'web',
    'data', jsonb_build_object('type', 'customer_action'));
  if opp is not null then ev := ev || jsonb_build_object('oppref', opp); end if;
  insert into public.openai_capi_events(lead_id, event_id, event) values (new.id, ev->>'id', ev)
  on conflict (event_id) do nothing;
  return new;
exception when others then raise warning 'openai_capi_on_lead: %', sqlerrm; return new;   -- never block saving a lead
end $$;
drop trigger if exists openai_capi_on_lead on public.leads;
create trigger openai_capi_on_lead after insert on public.leads for each row execute function public.openai_capi_on_lead();

-- read OpenAI's answers, then send what is waiting (every 2 minutes)
create or replace function public.openai_capi_run() returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.openai_capi_config; k text; r record; body jsonb; ids bigint[]; req bigint; n int := 0;
begin
  for r in select distinct e.request_id, h.status_code, h.content, h.error_msg
             from public.openai_capi_events e join net._http_response h on h.id = e.request_id
            where e.status = 'sending' loop
    update public.openai_capi_events
       set status = case when r.status_code between 200 and 299 then 'sent' else 'error' end,
           sent_at = case when r.status_code between 200 and 299 then now() end,
           response_code = r.status_code, response = left(coalesce(r.content, r.error_msg, ''), 1000)
     where request_id = r.request_id and status = 'sending';
    if r.status_code between 200 and 299 then
      update public.openai_capi_config set last_ok = now(), last_error = null where id = 1;
    else
      update public.openai_capi_config set last_error = left('HTTP ' || coalesce(r.status_code::text, '-') || ': ' || coalesce(r.content, r.error_msg, ''), 300) where id = 1;
    end if;
  end loop;
  -- no answer after 10 minutes: send again (same event id, so OpenAI never counts it twice)
  update public.openai_capi_events e set status = 'queued', request_id = null
   where e.status = 'sending' and e.sending_at < now() - interval '10 minutes'
     and not exists (select 1 from net._http_response h where h.id = e.request_id);
  -- OpenAI accepts events up to 7 days old
  update public.openai_capi_events set status = 'expired'
   where status = 'queued' and ((event->>'timestamp_ms')::bigint) < (extract(epoch from now() - interval '7 days') * 1000)::bigint;

  select * into c from public.openai_capi_config where id = 1;
  if not found or not c.enabled or coalesce(c.pixel_id, '') = '' then return jsonb_build_object('ok', false, 'reason', 'no Pixel ID'); end if;
  select decrypted_secret into k from vault.decrypted_secrets where name = 'openai_capi_key' limit 1;
  if coalesce(k, '') = '' then return jsonb_build_object('ok', false, 'reason', 'no API key in Vault'); end if;

  select array_agg(id order by id), jsonb_agg(event order by id), count(*) into ids, body, n
    from (select id, event from public.openai_capi_events where status = 'queued' order by id limit 200) q;
  if n = 0 then return jsonb_build_object('ok', true, 'sent', 0); end if;

  req := net.http_post(
    url := 'https://bzr.openai.com/v1/events?pid=' || c.pixel_id,
    body := jsonb_build_object('validate_only', c.validate_only, 'events', body),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || k),
    timeout_milliseconds := 30000);
  update public.openai_capi_events set status = 'sending', request_id = req, sending_at = now() where id = any(ids);
  return jsonb_build_object('ok', true, 'sent', n);
end $$;
revoke execute on function public.openai_capi_run() from anon, authenticated, public;

-- Settings → Lead sources (admins): set up?, counts, last answer – never the key
create or replace function public.openai_capi_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'pixel_set', coalesce(c.pixel_id, '') <> '',
    'key_set', exists (select 1 from vault.secrets s where s.name = 'openai_capi_key'),
    'enabled', c.enabled, 'validate_only', c.validate_only, 'last_ok', c.last_ok, 'last_error', c.last_error,
    'counts', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from public.openai_capi_events group by 1) x), '{}'::jsonb))
    from public.openai_capi_config c where c.id = 1 and public.is_admin()
$$;
grant execute on function public.openai_capi_status() to authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'openai-capi';
select cron.schedule('openai-capi', '*/2 * * * *', $c$ select public.openai_capi_run() $c$);

notify pgrst, 'reload schema';
