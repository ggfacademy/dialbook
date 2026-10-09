-- Dialbook Pro – telecallers can pass a lead to a colleague, with a reason (e.g. "Telugu lead").
-- Run once in Supabase → SQL Editor, after schema.sql and personal-calls.sql. Safe to run again.
-- Every transfer is recorded on the lead and listed for admins in Reports → Lead transfers.

-- Telecallers can't change who owns a lead, except through log_phone_call / transfer_lead
create or replace function public.leads_before_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_mgr() and coalesce(current_setting('dialbook.assign_ok', true), '') <> '1' then
    new.assigned_to := old.assigned_to;
  end if;
  new.updated_at := now();
  return new;
end $$;

create or replace function public.transfer_lead(p_lead uuid, p_to uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare l public.leads; who text;
begin
  if not public.is_active() then raise exception 'not approved'; end if;
  select * into l from public.leads where id = p_lead;
  if not found then raise exception 'lead not found'; end if;
  if not (l.assigned_to = auth.uid() or public.is_mgr()) then raise exception 'you can only transfer your own leads'; end if;
  if p_to is null or p_to = l.assigned_to then raise exception 'pick another team member'; end if;
  select name into who from public.profiles where id = p_to and active;
  if who is null then raise exception 'that team member is not active'; end if;
  if length(trim(coalesce(p_note, ''))) < 2 then raise exception 'add a short reason, e.g. "Telugu lead"'; end if;

  perform set_config('dialbook.assign_ok', '1', true);
  update public.leads
     set assigned_to = p_to,
         next_follow_up_at = coalesce(next_follow_up_at, now())   -- shows up for the new owner straight away
   where id = l.id;
  perform set_config('dialbook.assign_ok', '', true);

  insert into public.activities(lead_id, actor_id, kind, text, data)
  values (l.id, auth.uid(), 'assign', trim(p_note),
          jsonb_build_object('to', p_to, 'from', l.assigned_to, 'transfer', true, 'note', trim(p_note)));
end $$;
revoke execute on function public.transfer_lead(uuid, uuid, text) from anon, public;
grant execute on function public.transfer_lead(uuid, uuid, text) to authenticated;

create index if not exists activities_transfers on public.activities(created_at) where kind = 'assign' and (data->>'transfer') = 'true';

notify pgrst, 'reload schema';
