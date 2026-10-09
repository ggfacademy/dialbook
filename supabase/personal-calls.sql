-- Dialbook Pro – only leads' calls are saved; personal calls never reach the CRM.
-- Run once in Supabase → SQL Editor, after schema.sql. Safe to run again.
--
-- The phone app saves a call (and its recording) only when the number is already a lead.
-- A call with any other number is not saved. After such a call the phone app asks the telecaller:
--   "Add as lead"   → the lead is created and this call + recording are saved;
--   "Personal call" → nothing is saved, and the app does not ask again for that number.
-- (Unknown numbers are no longer added automatically from phone calls. The Settings switch for
-- unknown numbers now only applies to WhatsApp messages to the company number.)
--
-- Old "New caller …" leads made from personal calls can be removed with
-- "This is a personal number" on the lead, or with the clean-up at the end of this file.

create table if not exists public.personal_numbers (
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  phone_key text not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, phone_key)
);
alter table public.personal_numbers enable row level security;
drop policy if exists p_personal_sel on public.personal_numbers;
create policy p_personal_sel on public.personal_numbers for select to authenticated using (owner_id = auth.uid() or public.is_mgr());
drop policy if exists p_personal_del on public.personal_numbers;
create policy p_personal_del on public.personal_numbers for delete to authenticated using (owner_id = auth.uid() or public.is_admin());

-- Telecallers can't change who owns a lead, except through log_phone_call below (a call to an unowned number)
create or replace function public.leads_before_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_mgr() and coalesce(current_setting('dialbook.assign_ok', true), '') <> '1' then
    new.assigned_to := old.assigned_to;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop function if exists public.log_phone_call(text, text, timestamptz, int, text);
create or replace function public.log_phone_call(
  p_phone text, p_direction text, p_started_at timestamptz, p_duration int, p_external_id text,
  p_saved_contact boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  k text := right(regexp_replace(coalesce(p_phone,''), '\D', '', 'g'), 10);
  l record;
  cid uuid;
  dup boolean := false;
begin
  if not public.is_active() then raise exception 'not approved'; end if;
  if length(k) < 6 then return null; end if;
  if exists (select 1 from public.personal_numbers where owner_id = auth.uid() and phone_key = k) then return null; end if;

  select id, name, assigned_to into l from public.leads where phone_key = k
   order by (assigned_to = auth.uid()) desc nulls last, updated_at desc limit 1;

  if not found then
    return null;   -- not a lead: personal or unknown, never saved (the phone app asks the telecaller)
  end if;

  -- A number in the CRM that nobody owns (e.g. the old contact list) becomes this telecaller's lead,
  -- so they can see it, log the outcome and find the callback in "My leads".
  if l.assigned_to is null then
    perform set_config('dialbook.assign_ok', '1', true);
    update public.leads set assigned_to = auth.uid() where id = l.id;
    perform set_config('dialbook.assign_ok', '', true);
    insert into public.activities(lead_id, actor_id, kind, data)
    values (l.id, auth.uid(), 'assign', jsonb_build_object('to', auth.uid(), 'rule', false, 'reason', 'phone call'));
  end if;

  insert into public.calls(lead_id, agent_id, source, direction, started_at, duration, connected, external_id)
  values (l.id, auth.uid(), 'phone', p_direction, p_started_at, greatest(coalesce(p_duration,0),0),
          coalesce(p_duration,0) > 0, p_external_id)
  on conflict (external_id) do nothing
  returning id into cid;

  if cid is null then
    select id into cid from public.calls where external_id = p_external_id;
    dup := true;
  end if;
  return jsonb_build_object('call_id', cid, 'lead_id', l.id, 'lead_name', l.name, 'duplicate', dup);
end $$;
revoke execute on function public.log_phone_call(text, text, timestamptz, int, text, boolean) from anon, public;
grant execute on function public.log_phone_call(text, text, timestamptz, int, text, boolean) to authenticated;

-- "To log" in the phone app: this telecaller's calls without an outcome, with the lead's name and number
create or replace function public.calls_to_log(p_days int default 3)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x.started_at desc), '[]'::jsonb) from (
    select c.id, c.started_at, c.duration, c.direction, c.lead_id, l.name as lead_name, l.phone as lead_phone,
           (l.assigned_to = auth.uid()) as mine
      from public.calls c join public.leads l on l.id = c.lead_id
     where c.agent_id = auth.uid() and c.outcome is null
       and c.started_at >= now() - make_interval(days => greatest(1, coalesce(p_days, 3)))
     order by c.started_at desc limit 50) x
$$;
revoke execute on function public.calls_to_log(int) from anon, public;
grant execute on function public.calls_to_log(int) to authenticated;

-- One-time: calls already logged on leads nobody owns go to the telecaller who made them
with t as (
  select distinct on (c.lead_id) c.lead_id, c.agent_id from public.calls c join public.leads l on l.id = c.lead_id
   where l.assigned_to is null and c.agent_id is not null and c.source = 'phone' and c.started_at > now() - interval '30 days'
   order by c.lead_id, c.started_at desc)
update public.leads l set assigned_to = t.agent_id from t where l.id = t.lead_id and l.assigned_to is null;

-- After a call with an unknown number, the telecaller tapped "Add as lead" in the phone app
create or replace function public.add_call_lead(
  p_phone text, p_name text, p_direction text, p_started_at timestamptz, p_duration int, p_external_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare k text := right(regexp_replace(coalesce(p_phone,''), '\D', '', 'g'), 10); lid uuid;
begin
  if not public.is_active() then raise exception 'not approved'; end if;
  if length(k) < 6 then raise exception 'this number is too short'; end if;
  delete from public.personal_numbers where owner_id = auth.uid() and phone_key = k;
  if not exists (select 1 from public.leads where phone_key = k) then
    insert into public.leads(name, phone, source, assigned_to, created_by)
    values (coalesce(nullif(trim(p_name), ''), 'New caller ' || right(k, 4)), p_phone,
            case when p_direction = 'outgoing' then 'Phone call' else 'Incoming call' end, auth.uid(), auth.uid())
    returning id into lid;
    insert into public.activities(lead_id, actor_id, kind, text) values (lid, auth.uid(), 'created', 'Added by the telecaller after a phone call');
  end if;
  return public.log_phone_call(p_phone, p_direction, p_started_at, p_duration, p_external_id);
end $$;
revoke execute on function public.add_call_lead(text, text, text, timestamptz, int, text) from anon, public;
grant execute on function public.add_call_lead(text, text, text, timestamptz, int, text) to authenticated;

-- "Personal number": only for leads the phone app added from an unknown incoming call
create or replace function public.mark_personal(p_lead uuid) returns void
language plpgsql security definer set search_path = public as $$
declare l public.leads;
begin
  select * into l from public.leads where id = p_lead;
  if not found then raise exception 'lead not found'; end if;
  if not (l.assigned_to = auth.uid() or l.created_by = auth.uid() or public.is_mgr()) then raise exception 'not your lead'; end if;
  if l.source <> 'Incoming call' then
    raise exception 'only leads added from an unknown incoming call can be marked personal';
  end if;
  insert into public.personal_numbers(owner_id, phone_key)
  values (coalesce(l.created_by, auth.uid()), l.phone_key) on conflict do nothing;
  delete from public.leads where id = l.id;
end $$;
revoke execute on function public.mark_personal(uuid) from anon, public;
grant execute on function public.mark_personal(uuid) to authenticated;

notify pgrst, 'reload schema';

-- Optional clean-up of personal calls already added. Look first:
--   select name, phone, created_at from public.leads
--    where source = 'Incoming call' and name like 'New caller %' and stage = 'new' order by created_at desc;
-- Then delete the ones nobody has worked on (no outcome, note or WhatsApp yet):
--   delete from public.leads l
--    where l.source = 'Incoming call' and l.name like 'New caller %' and l.stage = 'new'
--      and not exists (select 1 from public.calls c where c.lead_id = l.id and (c.outcome is not null or coalesce(c.note,'') <> ''))
--      and not exists (select 1 from public.activities a where a.lead_id = l.id and a.kind <> 'created');
