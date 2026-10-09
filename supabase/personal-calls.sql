-- Dialbook Pro – keep telecallers' personal calls out of the CRM.
-- Run once in Supabase → SQL Editor, after schema.sql. Safe to run again.
--
-- The phone app only logs calls with numbers that are leads. The one exception is
-- Settings → "When an unknown number calls a telecaller's phone, add it as a new lead".
-- With this file:
--   * an unknown caller whose number is saved in the telecaller's phone contacts (family, friends)
--     is never added as a lead (needs the updated phone app);
--   * a telecaller can mark an auto-added "New caller" lead as "Personal number": the lead is deleted
--     and calls with that number from their phone are never logged again.

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
  auto boolean;
begin
  if not public.is_active() then raise exception 'not approved'; end if;
  if length(k) < 6 then return null; end if;
  if exists (select 1 from public.personal_numbers where owner_id = auth.uid() and phone_key = k) then return null; end if;

  select id, name into l from public.leads where phone_key = k
   order by (assigned_to = auth.uid()) desc nulls last, updated_at desc limit 1;

  if not found then
    select coalesce((data->>'autoCreateIncoming')::boolean, false) into auto from public.settings where id = 1;
    if auto and not coalesce(p_saved_contact, false) and p_direction in ('incoming','missed') then
      insert into public.leads(name, phone, source, assigned_to, created_by)
      values ('New caller ' || right(k, 4), p_phone, 'Incoming call', auth.uid(), auth.uid())
      returning id, name into l;
      insert into public.activities(lead_id, actor_id, kind, text) values (l.id, auth.uid(), 'created', 'Incoming call');
    else
      return null;
    end if;
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
