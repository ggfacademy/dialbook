-- Dialbook Pro – merge duplicate leads created by importing the same file more than once.
-- Run in Supabase → SQL Editor (after enquiry-date.sql). Safe to run again.
--
-- For every phone number that has more than one lead, where at least one copy came from an import of
-- the given source today (default 'Interakt'):
--   * the OLDEST lead is kept, so its history stays;
--   * calls, recordings, notes/activity, WhatsApp chats and AI calls of the copies move onto it;
--   * it gets source = 'Interakt', the campaign/language from the import (if it had none / missing),
--     its "enquired" date becomes today, and it is due for a call today;
--   * the copies are deleted;
--   * optionally every number from today's import is put into a campaign (by its exact name).
--
-- 1) Preview first (shows what will be merged):
--      select * from public.duplicate_leads_preview('Interakt');
-- 2) Merge (and put them in a campaign):
--      select public.merge_duplicate_leads('Interakt', 'Gold Appraisal Training - Vijayawada - Oct 26');

create or replace function public.duplicate_leads_preview(p_source text default 'Interakt', p_since timestamptz default null)
returns table(phone text, copies int, kept_name text, kept_added timestamptz)
language sql stable security definer set search_path = public as $$
  with s as (select coalesce(p_since, date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata') as since),
  keys as (
    select l.phone_key from public.leads l, s
     where l.phone_key <> '' and lower(l.source) = lower(p_source) and l.created_at >= s.since
     group by l.phone_key),
  grp as (
    select l.phone_key, count(*)::int n, (array_agg(l.id order by l.created_at, l.id))[1] keep
      from public.leads l join keys k on k.phone_key = l.phone_key group by l.phone_key having count(*) > 1)
  select k.phone, g.n, k.name, k.created_at from grp g join public.leads k on k.id = g.keep order by k.name
$$;

drop function if exists public.merge_duplicate_leads(text, timestamptz);
create or replace function public.merge_duplicate_leads(p_source text default 'Interakt', p_campaign text default null, p_since timestamptz default null)
returns int language plpgsql security definer set search_path = public as $$
declare
  since timestamptz := coalesce(p_since, date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata');
  g record; k public.leads; d record; merged int := 0; cid uuid; keys text[];
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'only admins can merge leads'; end if;
  if coalesce(trim(p_campaign), '') <> '' then
    select id into cid from public.campaigns where lower(trim(name)) = lower(trim(p_campaign)) limit 1;
    if cid is null then raise exception 'No campaign named "%". Copy the name exactly from the Campaigns page.', p_campaign; end if;
  end if;
  -- the numbers in today's import
  select array_agg(distinct phone_key) into keys from public.leads
   where phone_key <> '' and lower(source) = lower(p_source) and created_at >= since;

  for g in
    select l.phone_key, array_agg(l.id order by l.created_at, l.id) ids
      from public.leads l
     where l.phone_key = any(coalesce(keys, '{}'))
     group by l.phone_key having count(*) > 1
  loop
    select * into k from public.leads where id = g.ids[1];
    for d in select * from public.leads where id = any(g.ids[2:]) order by created_at desc loop
      update public.calls       set lead_id = k.id where lead_id = d.id;
      update public.activities  set lead_id = k.id where lead_id = d.id;
      if to_regclass('public.wa_messages') is not null then execute 'update public.wa_messages set lead_id = $1 where lead_id = $2' using k.id, d.id; end if;
      if to_regclass('public.ai_calls') is not null then execute 'update public.ai_calls set lead_id = $1 where lead_id = $2' using k.id, d.id; end if;
      if to_regclass('public.lead_refs') is not null then execute 'update public.lead_refs set lead_id = $1 where lead_id = $2' using k.id, d.id; end if;
      if to_regclass('public.nurture_enrollments') is not null then
        execute 'delete from public.nurture_enrollments e where e.lead_id = $2 and exists (select 1 from public.nurture_enrollments x where x.lead_id = $1)' using k.id, d.id;
        execute 'update public.nurture_enrollments set lead_id = $1 where lead_id = $2' using k.id, d.id;
      end if;
      update public.leads set
          name        = case when k.name ~* '^(unnamed|new caller|whatsapp) ?[0-9]*$' or k.name = '' then coalesce(nullif(d.name, ''), k.name) else k.name end,
          campaign_id = coalesce(d.campaign_id, k.campaign_id),
          language    = coalesce(nullif(k.language, ''), d.language, ''),
          city        = coalesce(nullif(k.city, ''), d.city, ''),
          email       = coalesce(nullif(k.email, ''), d.email, ''),
          tags        = array(select distinct t from unnest(coalesce(k.tags, '{}') || coalesce(d.tags, '{}')) t),
          assigned_to = coalesce(k.assigned_to, d.assigned_to),
          call_count  = coalesce(k.call_count, 0) + coalesce(d.call_count, 0),
          last_call_at = greatest(k.last_call_at, d.last_call_at)
       where id = k.id;
      select * into k from public.leads where id = k.id;
      delete from public.leads where id = d.id;
    end loop;
    -- the kept lead: source Interakt, enquired today, due for a call today
    update public.leads set source = p_source, contact_only = false,
           next_follow_up_at = case when stage = 'won' then next_follow_up_at else now() end
     where id = k.id;
    insert into public.activities(lead_id, kind, text, data)
    values (k.id, 'enquiry', 'Enquired again via ' || p_source || ' (duplicate copies merged)', jsonb_build_object('source', p_source, 'merged', array_length(g.ids, 1) - 1));
    merged := merged + array_length(g.ids, 1) - 1;
  end loop;
  if cid is not null then
    update public.leads set campaign_id = cid where phone_key = any(coalesce(keys, '{}'));
  end if;
  return merged;
end $$;
revoke execute on function public.merge_duplicate_leads(text, text, timestamptz) from anon, public;
revoke execute on function public.duplicate_leads_preview(text, timestamptz) from anon, public;
grant execute on function public.merge_duplicate_leads(text, text, timestamptz) to authenticated;
grant execute on function public.duplicate_leads_preview(text, timestamptz) to authenticated;
