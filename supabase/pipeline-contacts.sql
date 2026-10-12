-- Dialbook Pro – keep the contact list (old data for messages) out of the Pipeline and dashboard counts.
-- Run once in Supabase → SQL Editor, after contacts.sql. Safe to run again.
--
-- Contact-list numbers stay in the CRM for WhatsApp messages. They come back into the Pipeline, with
-- their history, as soon as the person enquires again (form, WhatsApp) or a telecaller calls / is
-- called by them (the call assigns the lead to that telecaller).

create or replace function public.lead_summary(p_agent uuid default null, p_campaign uuid default null, p_tz text default 'Asia/Kolkata')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare agent uuid := p_agent; res jsonb;
  t0 timestamptz := date_trunc('day', now() at time zone public.safe_tz(p_tz)) at time zone public.safe_tz(p_tz);
begin
  if not public.is_active() then raise exception 'not approved'; end if;
  if not public.is_mgr() then agent := auth.uid(); end if;
  with l as (
    select * from public.leads
     where (agent is null or assigned_to = agent) and (p_campaign is null or campaign_id = p_campaign)
       and not contact_only
  )
  select jsonb_build_object(
    'total', (select count(*) from l),
    'stages', (select coalesce(jsonb_object_agg(stage, jsonb_build_object('n', n, 'value', v)), '{}'::jsonb)
                 from (select stage, count(*) n, coalesce(sum(value),0) v from l group by stage) t),
    'overdue', (select count(*) from l where stage not in ('won','lost') and next_follow_up_at < now()),
    'today', (select count(*) from l where stage not in ('won','lost') and next_follow_up_at >= now() and next_follow_up_at < t0 + interval '1 day'),
    'fresh', (select count(*) from l where call_count = 0 and stage not in ('won','lost')),
    'unassigned', (select count(*) from l where assigned_to is null)
  ) into res;
  return res;
end $$;

-- Old imported numbers that were never worked on, but were imported as normal leads:
-- move them to the contact list. Nothing with a call, a note, a stage change, an enquiry or a
-- WhatsApp reply is touched.
--   Preview:  select * from public.old_leads_to_contacts('2026-10-04', true);
--   Move:     select * from public.old_leads_to_contacts('2026-10-04', false);
create or replace function public.old_leads_to_contacts(p_before date, p_preview boolean default true)
returns table(leads int, example_names text)
language plpgsql security definer set search_path = public as $$
declare cutoff timestamptz := (p_before::timestamp at time zone 'Asia/Kolkata'); ids uuid[];
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'only admins can do this'; end if;
  select array_agg(l.id) into ids from public.leads l
   where l.created_at < cutoff and l.stage = 'new' and not l.contact_only and not l.dnd and coalesce(l.call_count, 0) = 0
     and not exists (select 1 from public.calls c where c.lead_id = l.id)
     and not exists (select 1 from public.activities a where a.lead_id = l.id and a.kind in ('enquiry','note','stage','msg','ai'))
     and (to_regclass('public.wa_messages') is null
          or not exists (select 1 from public.wa_messages w where w.lead_id = l.id and w.direction = 'in'));
  leads := coalesce(array_length(ids, 1), 0);
  select string_agg(name, ', ') into example_names from (select name from public.leads where id = any(coalesce(ids, '{}')) limit 8) x;
  if not p_preview and leads > 0 then
    update public.leads set contact_only = true, assigned_to = null, next_follow_up_at = null where id = any(ids);
  end if;
  return next;
end $$;
revoke execute on function public.old_leads_to_contacts(date, boolean) from anon, public;

notify pgrst, 'reload schema';
