-- Dialbook Pro – removing and rejecting team members properly.
-- Run once in Supabase → SQL Editor, after schema.sql. Safe to run again.
--
-- Before this, "Reject" / "Remove" in Team only deleted the person's team row. Their login stayed,
-- so the email could not be used to sign up again ("User already registered"), and signing in with it
-- showed "Waiting for approval" while the admin could no longer see them in Team.
-- Now the login is deleted too, and anyone signed in without a team row is put back on the
-- "Waiting for approval" list.

-- Admin removes a person: deletes their login (their team row goes with it, their leads become unassigned)
create or replace function public.remove_member(p_id uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'only admins can remove team members'; end if;
  if p_id = auth.uid() then raise exception 'you cannot remove yourself'; end if;
  delete from public.profiles where id = p_id;
  delete from auth.users where id = p_id;
end $$;
revoke execute on function public.remove_member(uuid) from anon, public;
grant execute on function public.remove_member(uuid) to authenticated;

-- A signed-in person with no team row asks for approval again
create or replace function public.request_access() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.profiles(id, name, email, role, active)
  select u.id, coalesce(nullif(u.raw_user_meta_data->>'name',''), split_part(u.email,'@',1)), u.email, 'telecaller', false
    from auth.users u where u.id = auth.uid()
  on conflict (id) do nothing;
end $$;
revoke execute on function public.request_access() from anon, public;
grant execute on function public.request_access() to authenticated;

-- One-time clean-up: delete logins of people already rejected or removed (they have no team row),
-- so their emails can be used to sign up again.
delete from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id);

notify pgrst, 'reload schema';
