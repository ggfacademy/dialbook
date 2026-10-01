-- Dialbook Pro – contact lists (old data for messaging) and "do not contact" blocking.
-- Run once in Supabase → SQL Editor, after schema.sql, whatsapp.sql, leadsources.sql and nurture.sql.
-- Safe to run again.
--
-- Contact list: leads imported as "contact list" are not given to telecallers, are not in calling
-- lists, share-outs or automatic nurture. They can be messaged (nurture "Add existing leads", or an
-- export for Interakt campaigns). When such a person enquires again (Facebook/Instagram/website form)
-- or sends a WhatsApp message, they become a normal lead and are assigned by your rules.
--
-- Do not contact: a lead marked "do not call" (dnd) is left out of calling lists, AI calls, nurture
-- and WhatsApp sending. The call outcome "Asked not to be contacted" sets it.

alter table public.leads add column if not exists contact_only boolean not null default false;
create index if not exists leads_contact_only on public.leads(contact_only) where contact_only;

-- New leads: contact-list leads are never auto-assigned
create or replace function public.leads_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.language := public.norm_language(new.language);
  if new.language = '' and new.campaign_id is not null then
    select language into new.language from public.campaigns where id = new.campaign_id;
    new.language := coalesce(new.language, '');
  end if;
  if new.contact_only then
    new.assigned_to := null;
  elsif new.assigned_to is null then
    new.assigned_to := public.pick_assignee(new.language, new.source, new.campaign_id);
  end if;
  return new;
end $$;

-- Giving a contact-list lead to someone by hand turns it into a normal lead
create or replace function public.leads_contact_assign() returns trigger
language plpgsql as $$
begin
  if new.contact_only and new.assigned_to is not null and old.assigned_to is distinct from new.assigned_to then
    new.contact_only := false;
  end if;
  return new;
end $$;
drop trigger if exists leads_contact_assign on public.leads;
create trigger leads_contact_assign before update of assigned_to on public.leads
  for each row execute function public.leads_contact_assign();

-- A contact-list person who enquires again or writes on WhatsApp becomes a new lead for the team
create or replace function public.promote_contact(p_lead uuid, p_source text) returns void
language plpgsql security definer set search_path = public as $$
declare l public.leads; who uuid;
begin
  select * into l from public.leads where id = p_lead;
  if not found then return; end if;
  if l.dnd then
    -- respect the block: keep it out of calling lists, but keep the enquiry on record
    update public.leads set next_follow_up_at = null, contact_only = false where id = l.id and (contact_only or next_follow_up_at is not null);
    return;
  end if;
  if not l.contact_only then return; end if;
  who := coalesce(l.assigned_to, public.pick_assignee(l.language, coalesce(nullif(p_source, ''), l.source), l.campaign_id));
  update public.leads
     set contact_only = false, assigned_to = who,
         stage = case when stage in ('won') then stage else 'new' end,
         next_follow_up_at = now(), updated_at = now()
   where id = l.id;
  insert into public.activities(lead_id, kind, text, data)
  values (l.id, 'assign', 'Moved from the contact list: enquired again', jsonb_build_object('to', who, 'rule', true, 'source', p_source));
end $$;
revoke execute on function public.promote_contact(uuid, text) from anon, authenticated, public;

create or replace function public.activities_promote() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'enquiry' then perform public.promote_contact(new.lead_id, new.data->>'source'); end if;
  return new;
end $$;
drop trigger if exists activities_promote on public.activities;
create trigger activities_promote after insert on public.activities
  for each row execute function public.activities_promote();

create or replace function public.wa_in_promote() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.direction = 'in' and new.lead_id is not null then perform public.promote_contact(new.lead_id, 'WhatsApp'); end if;
  return new;
end $$;
drop trigger if exists wa_in_promote on public.wa_messages;
create trigger wa_in_promote after insert on public.wa_messages
  for each row execute function public.wa_in_promote();

-- Share-outs and "assign by rules" skip the contact list
create or replace function public.auto_assign_leads(p_ids uuid[] default null)
returns int language plpgsql security definer set search_path = public as $$
declare l record; who uuid; n int := 0;
begin
  if not public.is_mgr() then raise exception 'only managers can do this'; end if;
  for l in select id, language, source, campaign_id from public.leads
            where (p_ids is null and assigned_to is null and not contact_only) or (p_ids is not null and id = any(p_ids))
            order by created_at limit 5000 loop
    who := public.pick_assignee(l.language, l.source, l.campaign_id);
    if who is not null then
      update public.leads set assigned_to = who where id = l.id;
      insert into public.activities(lead_id, actor_id, kind, data) values (l.id, auth.uid(), 'assign', jsonb_build_object('to', who, 'rule', true));
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

create or replace function public.distribute_leads(p_which text, p_campaign uuid, p_agents uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_mgr() then raise exception 'only managers can share out leads'; end if;
  if coalesce(array_length(p_agents, 1), 0) = 0 then return 0; end if;
  with pick as (
    select id, row_number() over (order by created_at) - 1 as rn from public.leads
     where (p_campaign is null or campaign_id = p_campaign) and not contact_only and not dnd
       and case p_which when 'unassigned' then assigned_to is null
                        when 'fresh' then call_count = 0 and stage not in ('won','lost')
                        else stage not in ('won','lost') end
  ), upd as (
    update public.leads l set assigned_to = p_agents[(pick.rn % array_length(p_agents,1)) + 1]
      from pick where l.id = pick.id returning l.id
  ) select count(*) into n from upd;
  return n;
end $$;

-- Automatic nurture skips the contact list (use "Add existing leads" on a sequence to message them)
do $$ begin
  if to_regclass('public.nurture_sequences') is not null then
    execute $f$
    create or replace function public.nurture_auto_enroll() returns trigger
    language plpgsql security definer set search_path = public as $b$
    declare best uuid; cur public.nurture_enrollments;
    begin
      if new.dnd or new.contact_only or new.stage in ('won','lost') then return new; end if;
      if tg_op = 'UPDATE' and new.campaign_id is not distinct from old.campaign_id
         and new.language is not distinct from old.language and new.city is not distinct from old.city then return new; end if;
      best := public.nurture_best(new.campaign_id, new.language, new.city);
      if best is null then return new; end if;
      select * into cur from public.nurture_enrollments e where e.lead_id = new.id and e.status = 'active' limit 1;
      if found then
        if cur.sequence_id = best or cur.last_sent_at is not null then return new; end if;
        delete from public.nurture_enrollments where id = cur.id;
      end if;
      insert into public.nurture_enrollments(sequence_id, lead_id, next_at)
      select s.id, new.id, public.nurture_first_at(s) from public.nurture_sequences s where s.id = best
      on conflict (sequence_id, lead_id) do nothing;
      return new;
    end $b$;
    $f$;
  end if;
end $$;

-- "Do not contact" as a call outcome (sets the block automatically)
update public.settings
   set data = jsonb_set(data, '{dispositions}', coalesce(data->'dispositions', '[]'::jsonb) ||
         '[{"id":"dnd","name":"Asked not to be contacted","connected":true,"stage":"lost","fu":false}]'::jsonb)
 where id = 1 and data ? 'dispositions'
   and not exists (select 1 from jsonb_array_elements(data->'dispositions') x where x->>'id' = 'dnd');

create or replace function public.calls_dnd() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.outcome = 'dnd' then update public.leads set dnd = true, next_follow_up_at = null where id = new.lead_id; end if;
  return new;
end $$;
drop trigger if exists calls_dnd on public.calls;
create trigger calls_dnd after insert or update of outcome on public.calls
  for each row execute function public.calls_dnd();

notify pgrst, 'reload schema';
