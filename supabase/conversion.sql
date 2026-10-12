-- Dialbook Pro – faster first contact and hot-lead priority.
-- Run once in Supabase → SQL Editor, after leadsources.sql, nurture.sql and contacts.sql. Safe to run again.
--
-- 1. Hot / warm from the form answers: "Yes, I want to join" → Hot, "Call me" / "Need more details" → Warm.
--    A repeat enquiry that says "yes, I want to join" also makes the lead Hot.
-- 2. New enquiries from Facebook, Instagram, Google, website forms and WhatsApp are due for a call at once,
--    so they sit at the top of each telecaller's list (and in "Follow-ups due").
-- 3. The WhatsApp nurture check runs every 2 minutes, so a Day 0 message goes out within minutes.
-- 4. speed_to_lead(): how fast each telecaller makes the first call (Reports → Speed to lead).

create or replace function public.lead_intent(p_text text) returns text
language sql immutable as $$
  select case
    when p_text ~* '(yes[^a-z]{0,6}i[ _]*want[ _]*to[ _]*join|want[ _]*to[ _]*(join|enrol|enroll|register)|join[ _]*now|ready[ _]*to[ _]*(join|enrol|enroll|pay)|interested[ _]*to[ _]*join)' then 'hot'
    when p_text ~* '(call[ _]*me|need[ _]*more[ _]*(details|info)|more[ _]*information|send[ _]*details|fee[ _]*details)' then 'warm'
    else '' end
$$;

create or replace function public.leads_from_form() returns trigger
language plpgsql as $$
declare i text;
begin
  if coalesce(new.priority, '') = '' then
    i := public.lead_intent(coalesce(new.note, '') || ' ' || coalesce(new.extra::text, ''));
    if i <> '' then new.priority := i; end if;
  end if;
  -- an enquiry that arrived by itself (form, ad, WhatsApp): due for a call now
  if new.created_by is null and not coalesce(new.contact_only, false) and new.next_follow_up_at is null then
    new.next_follow_up_at := now();
  end if;
  return new;
end $$;
drop trigger if exists leads_from_form on public.leads;
create trigger leads_from_form before insert on public.leads
  for each row execute function public.leads_from_form();

create or replace function public.activities_intent() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'enquiry' and public.lead_intent(coalesce(new.text, '')) = 'hot' then
    update public.leads set priority = 'hot' where id = new.lead_id and priority is distinct from 'hot';
  end if;
  return new;
end $$;
drop trigger if exists activities_intent on public.activities;
create trigger activities_intent after insert on public.activities
  for each row execute function public.activities_intent();

-- Give the leads already in the CRM their priority from the form answers (only where none is set)
update public.leads set priority = public.lead_intent(coalesce(note, '') || ' ' || coalesce(extra::text, ''))
 where coalesce(priority, '') = '' and not coalesce(contact_only, false)
   and public.lead_intent(coalesce(note, '') || ' ' || coalesce(extra::text, '')) <> '';

-- Speed to lead: for leads that came in during the period, how long until the first call
create or replace function public.speed_to_lead(p_from timestamptz, p_to timestamptz, p_agent uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare agent uuid := p_agent; res jsonb;
begin
  if not public.is_active() then raise exception 'not approved'; end if;
  if not public.is_mgr() then agent := auth.uid(); end if;
  with l as (
    select l.id, l.assigned_to, l.created_at,
           (select min(c.started_at) from public.calls c where c.lead_id = l.id and c.started_at >= l.created_at - interval '1 minute') first_call
      from public.leads l
     where l.created_at >= p_from and l.created_at < p_to and not coalesce(l.contact_only, false)
       and l.created_by is null and (agent is null or l.assigned_to = agent)
  ), m as (
    select assigned_to, created_at, first_call, extract(epoch from (first_call - created_at)) / 60.0 mins from l
  )
  select coalesce(jsonb_agg(x order by x->>'name'), '[]'::jsonb) into res from (
    select jsonb_build_object(
      'agent', assigned_to,
      'leads', count(*),
      'called', count(first_call),
      'median_min', round((percentile_cont(0.5) within group (order by mins))::numeric, 1),
      'within_15', count(*) filter (where mins <= 15),
      'within_60', count(*) filter (where mins <= 60),
      'uncalled', count(*) filter (where first_call is null),
      'uncalled_1h', count(*) filter (where first_call is null and created_at < now() - interval '1 hour'),
      'name', coalesce((select name from public.profiles p where p.id = m.assigned_to), 'Unassigned')) x
    from m group by assigned_to) t;
  return res;
end $$;
revoke execute on function public.speed_to_lead(timestamptz, timestamptz, uuid) from anon, public;
grant execute on function public.speed_to_lead(timestamptz, timestamptz, uuid) to authenticated;

-- WhatsApp nurture: check every 2 minutes instead of 15
do $$ begin
  if to_regclass('cron.job') is not null then
    execute $q$select cron.alter_job(jobid, schedule := '*/2 * * * *') from cron.job where jobname = 'dialbook-nurture'$q$;
  end if;
end $$;

notify pgrst, 'reload schema';
