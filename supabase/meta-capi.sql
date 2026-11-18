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

-- =====================================================================================================
-- WhatsApp ad chats (click-to-WhatsApp). The whatsapp-webhook function saves Meta's click ID (ctwa_clid) for a chat
-- that started from an ad. Dialbook then reports, as "business messaging" events to the same dataset:
--   LeadSubmitted  when the chat arrives,  QualifiedLead  at Interested / Payment pending / Converted,
--   Purchase       at Converted (with the fee: the lead's value, else the campaign's fee, in INR).
-- Meta only accepts its standard event names for WhatsApp, so there is no Contacted / Lost here.
-- Sending starts once the WhatsApp Business Account ID is saved:
--   update public.meta_capi_config set waba_id = '<WhatsApp Business Account ID>' where id = 1;
-- and the Facebook token in Dialbook has access to that WhatsApp account (whatsapp_business_manage_events).
-- =====================================================================================================
alter table public.meta_capi_config add column if not exists waba_id text not null default '';

-- the amount reported with RegistrationPaid / Purchase: the lead's value, else the campaign's fee ("Rs. 15,000 including GST")
create or replace function public.meta_capi_value(p_lead uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(l.value, 0),
                  nullif(regexp_replace(split_part(coalesce(c.details->>'fee', ''), ' incl', 1), '\D', '', 'g'), '')::numeric)
    from public.leads l left join public.campaigns c on c.id = l.campaign_id where l.id = p_lead
$$;
revoke execute on function public.meta_capi_value(uuid) from anon, authenticated, public;

create table if not exists public.wa_ctwa (
  ctwa_clid text primary key,
  lead_id uuid references public.leads(id) on delete cascade,
  ad_id text not null default '',
  seen_at timestamptz not null default now()
);
create index if not exists wa_ctwa_lead on public.wa_ctwa(lead_id, seen_at desc);
alter table public.wa_ctwa enable row level security;
revoke all on public.wa_ctwa from anon, authenticated, public;

-- called by the whatsapp-webhook function (service role only)
create or replace function public.wa_ctwa_save(p_lead uuid, p_clid text, p_ad text, p_at timestamptz)
returns void language sql security definer set search_path = public as $$
  insert into public.wa_ctwa(ctwa_clid, lead_id, ad_id, seen_at)
  values (left(btrim(p_clid), 500), p_lead, coalesce(p_ad, ''), coalesce(p_at, now()))
  on conflict (ctwa_clid) do nothing
$$;
revoke execute on function public.wa_ctwa_save(uuid, text, text, timestamptz) from anon, authenticated, public;

create or replace function public.meta_capi_queue_wa(p_lead uuid, p_event text, p_clid text default null, p_at timestamptz default now())
returns void language plpgsql security definer set search_path = public as $$
declare k text := p_clid;
begin
  if k is null then select w.ctwa_clid into k from public.wa_ctwa w where w.lead_id = p_lead order by w.seen_at desc limit 1; end if;
  if k is null then return; end if;
  if p_event = 'Purchase' and coalesce(public.meta_capi_value(p_lead), 0) <= 0 then return; end if;   -- Meta needs a value
  insert into public.meta_capi_events(lead_id, meta_lead_id, event, event_time) values (p_lead, 'wa:' || k, p_event, p_at)
  on conflict (meta_lead_id, event) do nothing;
end $$;
revoke execute on function public.meta_capi_queue_wa(uuid, text, text, timestamptz) from anon, authenticated, public;

create or replace function public.meta_capi_on_wa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.meta_capi_queue_wa(new.lead_id, 'LeadSubmitted', new.ctwa_clid, new.seen_at);
  return new;
exception when others then raise warning 'meta_capi_on_wa: %', sqlerrm; return new;
end $$;
drop trigger if exists meta_capi_on_wa on public.wa_ctwa;
create trigger meta_capi_on_wa after insert on public.wa_ctwa for each row execute function public.meta_capi_on_wa();

create or replace function public.meta_capi_on_stage() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.stage is not distinct from old.stage then return new; end if;
  -- lead-form leads
  if new.stage in ('contacted', 'followup', 'interested', 'negotiation', 'won') then perform public.meta_capi_queue(new.id, 'Contacted'); end if;
  if new.stage in ('interested', 'negotiation', 'won') then perform public.meta_capi_queue(new.id, 'QualifiedLead'); end if;
  if new.stage = 'won' then perform public.meta_capi_queue(new.id, 'RegistrationPaid'); end if;
  -- named Lost or WrongNumber when it is sent (a few minutes later), after the lost reason has been saved
  if new.stage = 'lost' then perform public.meta_capi_queue(new.id, 'Lost'); end if;
  -- WhatsApp ad chats
  if new.stage in ('interested', 'negotiation', 'won') then perform public.meta_capi_queue_wa(new.id, 'QualifiedLead'); end if;
  if new.stage = 'won' then perform public.meta_capi_queue_wa(new.id, 'Purchase'); end if;
  return new;
exception when others then raise warning 'meta_capi_on_stage: %', sqlerrm; return new;
end $$;

-- read Meta's answers, then send the next batches: lead-form events and (once set up) WhatsApp events separately
create or replace function public.meta_capi_run() returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.meta_capi_config; fb jsonb; r record; body jsonb; ids bigint[]; req bigint; n int; total int := 0; kind text;
begin
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
  update public.meta_capi_events e set status = 'queued', request_id = null
   where e.status = 'sending' and not exists (select 1 from net._http_response h where h.id = e.request_id)
     and coalesce(e.sending_at, e.event_time) < now() - interval '10 minutes';
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

  select * into c from public.meta_capi_config where id = 1;
  if not c.enabled or coalesce(c.dataset_id, '') !~ '^[0-9]+$' then return jsonb_build_object('ok', false, 'reason', 'not set up'); end if;
  select value into fb from public.integration_secrets where key = 'facebook';
  if coalesce(fb->>'user_token', '') = '' then return jsonb_build_object('ok', false, 'reason', 'no Facebook token'); end if;

  foreach kind in array array['form', 'wa'] loop
    if kind = 'wa' and coalesce(c.waba_id, '') !~ '^[0-9]+$' then continue; end if;   -- WhatsApp: waits for the account ID
    ids := null; body := null; n := 0;
    select array_agg(e.id order by e.id),
           jsonb_agg(case when kind = 'wa' then
             jsonb_build_object(
               'event_name', e.event,
               'event_time', extract(epoch from e.event_time)::bigint,
               'event_id', e.meta_lead_id || ':' || e.event,
               'action_source', 'business_messaging',
               'messaging_channel', 'whatsapp',
               'user_data', jsonb_build_object('whatsapp_business_account_id', c.waba_id, 'ctwa_clid', substring(e.meta_lead_id from 4)),
               'custom_data', case when e.event = 'Purchase'
                                   then jsonb_build_object('value', public.meta_capi_value(e.lead_id), 'currency', 'INR') else '{}'::jsonb end)
           else
             jsonb_build_object(
               'event_name', e.event,
               'event_time', extract(epoch from e.event_time)::bigint,
               'event_id', e.meta_lead_id || ':' || e.event,
               'action_source', 'system_generated',
               'user_data', jsonb_build_object('lead_id', e.meta_lead_id::numeric),
               'custom_data', jsonb_build_object('event_source', 'crm', 'lead_event_source', 'Dialbook Pro')
                 || case when e.event = 'RegistrationPaid' and public.meta_capi_value(e.lead_id) > 0
                         then jsonb_build_object('value', public.meta_capi_value(e.lead_id), 'currency', 'INR') else '{}'::jsonb end)
           end order by e.id), count(*)
      into ids, body, n
      from (select * from public.meta_capi_events
             where status = 'queued' and (meta_lead_id like 'wa:%') = (kind = 'wa')
               and (event not in ('Lost', 'WrongNumber') or event_time < now() - interval '3 minutes')
             order by id limit 100) e;
    if n = 0 then continue; end if;
    req := net.http_post(
      url := 'https://graph.facebook.com/' || coalesce(nullif(fb->>'api_version', ''), 'v23.0') || '/' || c.dataset_id || '/events?access_token=' || (fb->>'user_token'),
      body := jsonb_build_object('data', body), timeout_milliseconds := 60000);
    update public.meta_capi_events set status = 'sending', request_id = req, sending_at = now() where id = any(ids);
    total := total + n;
  end loop;
  return jsonb_build_object('ok', true, 'sent', total);
end $$;
revoke execute on function public.meta_capi_run() from anon, authenticated, public;

-- Settings → Lead sources (admins): also whether WhatsApp reporting is set up
create or replace function public.meta_capi_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('dataset_id', c.dataset_id, 'enabled', c.enabled, 'last_ok', c.last_ok, 'last_error', c.last_error,
    'waba_set', coalesce(c.waba_id, '') <> '',
    'wa_clicks', (select count(*) from public.wa_ctwa),
    'counts', coalesce((select jsonb_object_agg(case when w then 'WA ' else '' end || event || ':' || status, n)
                          from (select meta_lead_id like 'wa:%' as w, event, status, count(*) n
                                  from public.meta_capi_events group by 1, 2, 3) x), '{}'::jsonb))
    from public.meta_capi_config c where c.id = 1 and public.is_admin()
$$;
grant execute on function public.meta_capi_status() to authenticated;

notify pgrst, 'reload schema';
