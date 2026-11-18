-- Dialbook Pro – tell Meta how Facebook / Instagram lead-form leads turn out (Conversions API for CRM).
-- Run once in Supabase → SQL Editor, after leadsources.sql. Safe to run again.
--
-- For every lead that came from a Facebook or Instagram lead form (it has Meta's lead ID), Dialbook sends Meta:
--   LeadSubmitted     when the lead arrives
--   Contacted         the first time it is moved past New (Contacted, Follow-up, Interested, Payment pending, Converted)
--   QualifiedLead     the first time it is moved to Interested, Payment pending or Converted
--   RegistrationPaid  when it is moved to Converted
--   Lost / WrongNumber when it is moved to Lost (WrongNumber when the lost reason or last call outcome is "Wrong number";
--                     sent 3+ minutes later so the reason is saved first, and not sent if the lead was reopened)
-- Only Meta's own lead ID is sent – never the name, phone or email. Each event goes once per Meta lead.
-- Events are sent every 5 minutes with the Facebook token saved in Settings → Lead sources → Facebook settings,
-- to the Meta dataset (pixel) set below. Meta accepts events up to 7 days old.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.meta_capi_config (
  id int primary key default 1 check (id = 1),
  dataset_id text not null default '',
  enabled boolean not null default true,
  last_ok timestamptz,
  last_error text
);
insert into public.meta_capi_config(id) values (1) on conflict do nothing;
alter table public.meta_capi_config enable row level security;          -- no policies: only the functions below
revoke all on public.meta_capi_config from anon, authenticated, public;

create table if not exists public.meta_capi_events (
  id bigserial primary key,
  lead_id uuid references public.leads(id) on delete set null,
  meta_lead_id text not null,
  event text not null,
  event_time timestamptz not null default now(),
  status text not null default 'queued',      -- queued → sending → sent | error | expired
  request_id bigint,
  error text,
  sending_at timestamptz,
  sent_at timestamptz,
  unique (meta_lead_id, event)
);
alter table public.meta_capi_events add column if not exists sending_at timestamptz;
create index if not exists meta_capi_events_status on public.meta_capi_events(status);
alter table public.meta_capi_events enable row level security;
revoke all on public.meta_capi_events from anon, authenticated, public;

-- queue one event for a lead's latest Meta lead ID (does nothing for leads that did not come from a Meta form)
create or replace function public.meta_capi_queue(p_lead uuid, p_event text, p_meta text default null)
returns void language plpgsql security definer set search_path = public as $$
declare m text := p_meta;
begin
  if m is null then
    select substring(r.ref from 4) into m from public.lead_refs r
     where r.lead_id = p_lead and r.ref ~ '^fb:[0-9]+$' order by r.created_at desc nulls last limit 1;
  end if;
  if m is null or m !~ '^[0-9]+$' then return; end if;
  insert into public.meta_capi_events(lead_id, meta_lead_id, event) values (p_lead, m, p_event)
  on conflict (meta_lead_id, event) do nothing;
end $$;
revoke execute on function public.meta_capi_queue(uuid, text, text) from anon, authenticated, public;

-- a new Meta lead arrived (also a known person enquiring again through a new form)
create or replace function public.meta_capi_on_ref() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.ref ~ '^fb:[0-9]+$' then perform public.meta_capi_queue(new.lead_id, 'LeadSubmitted', substring(new.ref from 4)); end if;
  return new;
exception when others then raise warning 'meta_capi_on_ref: %', sqlerrm; return new;
end $$;
drop trigger if exists meta_capi_on_ref on public.lead_refs;
create trigger meta_capi_on_ref after insert on public.lead_refs for each row execute function public.meta_capi_on_ref();

-- the lead moved forward
create or replace function public.meta_capi_on_stage() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.stage is not distinct from old.stage then return new; end if;
  if new.stage in ('contacted', 'followup', 'interested', 'negotiation', 'won') then perform public.meta_capi_queue(new.id, 'Contacted'); end if;
  if new.stage in ('interested', 'negotiation', 'won') then perform public.meta_capi_queue(new.id, 'QualifiedLead'); end if;
  if new.stage = 'won' then perform public.meta_capi_queue(new.id, 'RegistrationPaid'); end if;
  -- named Lost or WrongNumber when it is sent (a few minutes later), after the lost reason has been saved
  if new.stage = 'lost' then perform public.meta_capi_queue(new.id, 'Lost'); end if;
  return new;
exception when others then raise warning 'meta_capi_on_stage: %', sqlerrm; return new;
end $$;
drop trigger if exists meta_capi_on_stage on public.leads;
create trigger meta_capi_on_stage after update of stage on public.leads for each row execute function public.meta_capi_on_stage();

-- read Meta's answers to the last batch, then send the next one (every 5 minutes)
create or replace function public.meta_capi_run() returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.meta_capi_config; fb jsonb; r record; body jsonb; ids bigint[]; req bigint; n int := 0;
begin
  -- 1. answers
  for r in select distinct e.request_id, h.status_code, h.content, h.timed_out, h.error_msg
             from public.meta_capi_events e join net._http_response h on h.id = e.request_id
            where e.status = 'sending' loop
    if r.timed_out or r.status_code is null then
      -- no answer in time: send again later (same event_id, so Meta counts it once)
      update public.meta_capi_events set status = 'queued', request_id = null where request_id = r.request_id and status = 'sending';
    elsif r.status_code = 200 then
      update public.meta_capi_events set status = 'sent', sent_at = now(), error = null where request_id = r.request_id and status = 'sending';
      update public.meta_capi_config set last_ok = now(), last_error = null where id = 1;
    else
      update public.meta_capi_events set status = 'error',
             error = left(coalesce(r.content::jsonb #>> '{error,error_user_msg}', r.content::jsonb #>> '{error,message}', r.error_msg, 'HTTP ' || r.status_code), 300)
       where request_id = r.request_id and status = 'sending';
      update public.meta_capi_config set last_error = left(coalesce(r.content::jsonb #>> '{error,message}', r.error_msg, 'HTTP ' || r.status_code), 300) where id = 1;
    end if;
  end loop;
  -- a batch Meta never answered (10 min): try again
  update public.meta_capi_events e set status = 'queued', request_id = null
   where e.status = 'sending' and not exists (select 1 from net._http_response h where h.id = e.request_id)
     and coalesce(e.sending_at, e.event_time) < now() - interval '10 minutes';
  -- too old for Meta
  update public.meta_capi_events set status = 'expired' where status = 'queued' and event_time < now() - interval '7 days';

  -- a lost lead: Wrong number (lost reason or last call outcome) or Lost; skip if the lead was reopened meanwhile
  update public.meta_capi_events e set event = 'WrongNumber'
    from public.leads l
   where e.status = 'queued' and e.event = 'Lost' and l.id = e.lead_id
     and (l.lost_reason ilike '%wrong number%'
          or (select c2.outcome from public.calls c2 where c2.lead_id = l.id order by c2.created_at desc limit 1) = 'wrong_number')
     and not exists (select 1 from public.meta_capi_events x where x.meta_lead_id = e.meta_lead_id and x.event = 'WrongNumber');
  update public.meta_capi_events e set status = 'skipped'
    from public.leads l
   where e.status = 'queued' and e.event in ('Lost', 'WrongNumber') and l.id = e.lead_id and l.stage <> 'lost';

  -- 2. next batch
  select * into c from public.meta_capi_config where id = 1;
  if not c.enabled or coalesce(c.dataset_id, '') !~ '^[0-9]+$' then return jsonb_build_object('ok', false, 'reason', 'not set up'); end if;
  select value into fb from public.integration_secrets where key = 'facebook';
  if coalesce(fb->>'user_token', '') = '' then return jsonb_build_object('ok', false, 'reason', 'no Facebook token'); end if;

  select array_agg(e.id order by e.id), jsonb_agg(jsonb_build_object(
           'event_name', e.event,
           'event_time', extract(epoch from e.event_time)::bigint,
           'event_id', e.meta_lead_id || ':' || e.event,
           'action_source', 'system_generated',
           'user_data', jsonb_build_object('lead_id', e.meta_lead_id::numeric),
           'custom_data', jsonb_build_object('event_source', 'crm', 'lead_event_source', 'Dialbook Pro')) order by e.id), count(*)
    into ids, body, n
    from (select * from public.meta_capi_events
           where status = 'queued' and (event not in ('Lost', 'WrongNumber') or event_time < now() - interval '3 minutes')
           order by id limit 100) e;
  if n = 0 then return jsonb_build_object('ok', true, 'sent', 0); end if;

  req := net.http_post(
    url := 'https://graph.facebook.com/' || coalesce(nullif(fb->>'api_version', ''), 'v23.0') || '/' || c.dataset_id || '/events?access_token=' || (fb->>'user_token'),
    body := jsonb_build_object('data', body), timeout_milliseconds := 60000);
  update public.meta_capi_events set status = 'sending', request_id = req, sending_at = now() where id = any(ids);
  return jsonb_build_object('ok', true, 'sent', n);
end $$;
revoke execute on function public.meta_capi_run() from anon, authenticated, public;

-- Settings → Lead sources: is it on, what was sent (admins)
create or replace function public.meta_capi_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('dataset_id', c.dataset_id, 'enabled', c.enabled, 'last_ok', c.last_ok, 'last_error', c.last_error,
    'counts', coalesce((select jsonb_object_agg(event || ':' || status, n) from (select event, status, count(*) n from public.meta_capi_events group by 1, 2) x), '{}'::jsonb))
    from public.meta_capi_config c where c.id = 1 and public.is_admin()
$$;
grant execute on function public.meta_capi_status() to authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'meta-capi';
select cron.schedule('meta-capi', '*/5 * * * *', $c$ select public.meta_capi_run() $c$);

notify pgrst, 'reload schema';
