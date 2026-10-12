-- Dialbook Pro – lost reasons, daily targets, contact-list batches and the 15-minute Facebook check.
-- Run once in Supabase → SQL Editor, after nurture.sql, contacts.sql and leadsources.sql. Safe to run again.
--
-- 1. Lost reasons: every lead marked Lost keeps why (Fees too high, Joined elsewhere …).
--    Reports → Lost reasons shows them by program and caller.
-- 2. Daily targets: calls, connected calls and conversions per telecaller per day (Settings → Daily targets),
--    with progress on the dashboard and in the phone app.
-- 3. Contact list batches: send a nurture sequence to the contact list (old data) a few hundred a day,
--    so the WhatsApp number is not flagged for sending too many at once.
-- 4. Facebook leads are also pulled every 15 minutes, in case Meta's instant delivery misses one.
--    Needs the "leadsources" edge function redeployed.

/* ------------------------------------------------------------------ */
/* 1. Lost reasons                                                     */
/* ------------------------------------------------------------------ */
alter table public.leads add column if not exists lost_reason text not null default '';
alter table public.leads add column if not exists lost_at timestamptz;
create index if not exists leads_lost_at on public.leads(lost_at) where lost_at is not null;

update public.settings
   set data = data || jsonb_build_object('lostReasons',
       '["Fees too high","Not interested now","Joined another institute","Venue too far","Dates or timing not suitable","Language problem","Wanted only information","Not reachable after many calls","Wrong number","Other"]'::jsonb)
 where id = 1 and not (data ? 'lostReasons');

-- When a lead becomes Lost without a reason, the call outcome's name is used (e.g. "Not interested").
-- Reopening a lead clears the reason.
create or replace function public.leads_lost_reason() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.stage = 'lost' and old.stage is distinct from 'lost' then
    new.lost_at := now();
    if coalesce(new.lost_reason, '') = '' or new.lost_reason is not distinct from old.lost_reason then
      new.lost_reason := coalesce(nullif(public.dispo(new.last_outcome)->>'name', ''), 'Not given');
      if new.lost_reason = 'Not given' and new.dnd then new.lost_reason := 'Asked not to be contacted'; end if;
    end if;
  elsif new.stage <> 'lost' and old.stage = 'lost' then
    new.lost_reason := ''; new.lost_at := null;
  end if;
  return new;
end $$;
drop trigger if exists leads_lost_reason on public.leads;
create trigger leads_lost_reason before update of stage on public.leads
  for each row execute function public.leads_lost_reason();

-- Leads lost earlier: take the reason from their last call outcome
update public.leads l
   set lost_reason = coalesce(nullif(public.dispo(l.last_outcome)->>'name', ''), 'Not given'),
       lost_at = coalesce(l.lost_at, l.updated_at)
 where l.stage = 'lost' and coalesce(l.lost_reason, '') = '';

-- The telecaller (or a manager) gives the reason
create or replace function public.set_lost_reason(p_lead uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_active() then raise exception 'not approved'; end if;
  update public.leads set lost_reason = left(trim(coalesce(p_reason, '')), 200)
   where id = p_lead and stage = 'lost' and (assigned_to = auth.uid() or public.is_mgr());
end $$;
revoke execute on function public.set_lost_reason(uuid, text) from anon, public;
grant execute on function public.set_lost_reason(uuid, text) to authenticated;

-- Report: leads lost in the period, by reason, program and caller
create or replace function public.lost_reasons(p_from timestamptz, p_to timestamptz, p_agent uuid default null, p_campaign uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare agent uuid := p_agent; res jsonb;
begin
  if not public.is_active() then raise exception 'not approved'; end if;
  if not public.is_mgr() then agent := auth.uid(); end if;
  with l as (
    select coalesce(nullif(lost_reason, ''), 'Not given') reason, campaign_id, assigned_to
      from public.leads
     where stage = 'lost' and lost_at >= p_from and lost_at < p_to
       and (agent is null or assigned_to = agent) and (p_campaign is null or campaign_id = p_campaign)
  )
  select jsonb_build_object(
    'total', (select count(*) from l),
    'reasons', (select coalesce(jsonb_agg(jsonb_build_object('reason', reason, 'n', n) order by n desc), '[]'::jsonb)
                  from (select reason, count(*) n from l group by reason) t),
    'by_campaign', (select coalesce(jsonb_agg(jsonb_build_object('campaign', campaign_id, 'reason', reason, 'n', n)), '[]'::jsonb)
                  from (select campaign_id, reason, count(*) n from l group by campaign_id, reason) t),
    'by_agent', (select coalesce(jsonb_agg(jsonb_build_object('agent', assigned_to, 'reason', reason, 'n', n)), '[]'::jsonb)
                  from (select assigned_to, reason, count(*) n from l group by assigned_to, reason) t)
  ) into res;
  return res;
end $$;
revoke execute on function public.lost_reasons(timestamptz, timestamptz, uuid, uuid) from anon, public;
grant execute on function public.lost_reasons(timestamptz, timestamptz, uuid, uuid) to authenticated;

/* ------------------------------------------------------------------ */
/* 2. Daily targets                                                    */
/* ------------------------------------------------------------------ */
-- Settings → Daily targets stores { calls, connected, converted, agents: { profile id: { … } } }.
-- Today's progress for me (telecaller) or for everyone (managers, p_all = true).
create or replace function public.today_progress(p_tz text default 'Asia/Kolkata', p_all boolean default false)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  t0 timestamptz := date_trunc('day', now() at time zone public.safe_tz(p_tz)) at time zone public.safe_tz(p_tz);
  tg jsonb; res jsonb; everyone boolean := p_all and public.is_mgr();
begin
  if not public.is_active() then raise exception 'not approved'; end if;
  select coalesce(data->'targets', '{}'::jsonb) into tg from public.settings where id = 1;
  with p as (
    select id, name from public.profiles where active and (case when everyone then role = 'telecaller' or exists (select 1 from public.calls c where c.agent_id = profiles.id and c.started_at >= t0) else id = auth.uid() end)
  ), c as (
    select c.agent_id, count(*) n, count(*) filter (where c.connected or coalesce((public.dispo(c.outcome)->>'connected')::boolean, false)) conn,
           coalesce(sum(c.duration), 0) talk, count(*) filter (where public.dispo(c.outcome)->>'stage' = 'won') conv
      from public.calls c where c.started_at >= t0 and c.started_at < t0 + interval '1 day' and c.agent_id in (select id from p)
     group by c.agent_id
  ), f as (
    select assigned_to, count(*) due from public.leads
     where assigned_to in (select id from p) and stage not in ('won','lost') and not dnd
       and next_follow_up_at < t0 + interval '1 day'
     group by assigned_to
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'agent', p.id, 'name', p.name,
      'calls', coalesce(c.n, 0), 'connected', coalesce(c.conn, 0), 'talk', coalesce(c.talk, 0), 'converted', coalesce(c.conv, 0),
      'due', coalesce(f.due, 0),
      'target', jsonb_build_object(
        'calls', coalesce(nullif(tg->'agents'->(p.id::text)->>'calls', '')::int, nullif(tg->>'calls', '')::int, 0),
        'connected', coalesce(nullif(tg->'agents'->(p.id::text)->>'connected', '')::int, nullif(tg->>'connected', '')::int, 0),
        'converted', coalesce(nullif(tg->'agents'->(p.id::text)->>'converted', '')::int, nullif(tg->>'converted', '')::int, 0)))
      order by coalesce(c.n, 0) desc, p.name), '[]'::jsonb) into res
    from p left join c on c.agent_id = p.id left join f on f.assigned_to = p.id;
  return res;
end $$;
revoke execute on function public.today_progress(text, boolean) from anon, public;
grant execute on function public.today_progress(text, boolean) to authenticated;

/* ------------------------------------------------------------------ */
/* 3. Contact list batches                                             */
/* ------------------------------------------------------------------ */
-- Contact-list numbers that match: program, language, city (part of the name), tag. '' / null = any.
-- Numbers already in a running sequence, or that already got this sequence, are left out.
create or replace function public.contact_batch_pick(p_seq uuid, p_campaign uuid, p_language text, p_city text, p_tag text)
returns table(id uuid, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select l.id, l.created_at from public.leads l
   where l.contact_only and not l.dnd and l.phone_key <> '' and l.stage not in ('won','lost')
     and (p_campaign is null or l.campaign_id = p_campaign)
     and (coalesce(p_language, '') = '' or lower(l.language) = lower(p_language))
     and (coalesce(trim(p_city), '') = '' or l.city ilike '%' || trim(p_city) || '%')
     and (coalesce(trim(p_tag), '') = '' or exists (select 1 from unnest(l.tags) t where lower(t) = lower(trim(p_tag))))
     and not exists (select 1 from public.nurture_enrollments e where e.lead_id = l.id and (e.status = 'active' or e.sequence_id = p_seq))
$$;
revoke execute on function public.contact_batch_pick(uuid, uuid, text, text, text) from anon, authenticated, public;

create or replace function public.contact_batch_preview(p_seq uuid, p_campaign uuid default null, p_language text default '', p_city text default '', p_tag text default '')
returns int language plpgsql stable security definer set search_path = public as $$
declare n int;
begin
  if not public.is_mgr() then raise exception 'only managers can do this'; end if;
  select count(*) into n from public.contact_batch_pick(p_seq, p_campaign, p_language, p_city, p_tag);
  return n;
end $$;

-- Queue them: the first p_per_day go out today, the next p_per_day tomorrow from the start of sending hours, …
-- p_limit = most numbers in total (0 = all that match).
create or replace function public.contact_batch_send(p_seq uuid, p_campaign uuid default null, p_language text default '', p_city text default '',
  p_tag text default '', p_per_day int default 200, p_limit int default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.nurture_sequences; per int := greatest(10, least(coalesce(p_per_day, 200), 5000)); n int;
  h int; tz text := 'Asia/Kolkata'; day0 timestamptz;
begin
  if not public.is_mgr() then raise exception 'only managers can do this'; end if;
  select * into s from public.nurture_sequences where id = p_seq;
  if not found then raise exception 'sequence not found'; end if;
  if not s.active then raise exception 'Switch the sequence on first (Edit → Sequence is on).'; end if;
  if jsonb_array_length(s.steps) = 0 then raise exception 'The sequence has no steps.'; end if;
  select coalesce(nullif(data->'nurture'->>'startHour', '')::int, 9) into h from public.settings where id = 1;
  day0 := date_trunc('day', now() at time zone tz) at time zone tz;     -- today 00:00 India time
  with pick as (
    select id, row_number() over (order by created_at, id) - 1 rn
      from public.contact_batch_pick(p_seq, p_campaign, p_language, p_city, p_tag)
     order by created_at, id
     limit case when coalesce(p_limit, 0) > 0 then p_limit else null end
  ), sched as (
    select id, case when rn / per = 0 then now()
                    else day0 + (rn / per) * interval '1 day' + make_interval(hours => h) end
                 + coalesce((s.steps->0->>'day')::numeric, 0) * interval '1 day' t
      from pick
  ), ins as (
    insert into public.nurture_enrollments(sequence_id, lead_id, enrolled_at, next_at)
    select s.id, sched.id, sched.t, sched.t from sched
    on conflict (sequence_id, lead_id) do nothing
    returning 1
  ) select count(*) into n from ins;
  return jsonb_build_object('added', n, 'days', ceil(n::numeric / per)::int, 'per_day', per);
end $$;

-- Cancel the batches still waiting (numbers already messaged are not touched)
create or replace function public.contact_batch_cancel(p_seq uuid) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_mgr() then raise exception 'only managers can do this'; end if;
  delete from public.nurture_enrollments e using public.leads l
   where e.lead_id = l.id and e.sequence_id = p_seq and e.status = 'active' and e.step = 0
     and e.last_sent_at is null and l.contact_only;
  get diagnostics n = row_count;
  return n;
end $$;

-- How many contact-list numbers each sequence still has waiting
create or replace function public.contact_batch_waiting() returns table(sequence_id uuid, waiting int, next_at timestamptz)
language sql stable security definer set search_path = public as $$
  select e.sequence_id, count(*)::int, min(e.next_at) from public.nurture_enrollments e join public.leads l on l.id = e.lead_id
   where public.is_mgr() and l.contact_only and e.status = 'active' and e.step = 0 and e.last_sent_at is null
   group by e.sequence_id
$$;
revoke execute on function public.contact_batch_preview(uuid, uuid, text, text, text) from anon, public;
revoke execute on function public.contact_batch_send(uuid, uuid, text, text, text, int, int) from anon, public;
revoke execute on function public.contact_batch_cancel(uuid) from anon, public;
revoke execute on function public.contact_batch_waiting() from anon, public;
grant execute on function public.contact_batch_preview(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.contact_batch_send(uuid, uuid, text, text, text, int, int) to authenticated;
grant execute on function public.contact_batch_cancel(uuid) to authenticated;
grant execute on function public.contact_batch_waiting() to authenticated;

/* ------------------------------------------------------------------ */
/* 4. Facebook leads: also check every 15 minutes                      */
/* ------------------------------------------------------------------ */
-- Uses the same scheduler password as the nurture job. Leads already received are skipped.
do $$ begin
  if to_regclass('cron.job') is not null then
    execute $q$select cron.unschedule(jobid) from cron.job where jobname = 'dialbook-fb-fetch'$q$;
    execute $q$select cron.schedule('dialbook-fb-fetch', '*/15 * * * *', $cron$
      select net.http_post(
        url := 'https://yyrovakknsuanlolrlth.supabase.co/functions/v1/leadsources',
        headers := jsonb_build_object('Content-Type', 'application/json',
          'x-cron-token', (select value->>'token' from public.integration_secrets where key = 'nurture_cron')),
        body := '{"action":"cron_fetch"}'::jsonb)
    $cron$)$q$;
  end if;
end $$;

notify pgrst, 'reload schema';
