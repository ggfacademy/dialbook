-- Dialbook Pro – one-time: the lead source "Phone call" is written in capitals, "PHONE CALL", like FACEBOOK and INSTAGRAM.
-- Run once in Supabase → SQL Editor. Safe to run again.
-- Renames it on existing leads, and new leads added after a phone call get "PHONE CALL" (same as personal-calls.sql).

update public.leads set source = 'PHONE CALL' where source = 'Phone call';

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
            case when p_direction = 'outgoing' then 'PHONE CALL' else 'Incoming call' end, auth.uid(), auth.uid())
    returning id into lid;
    insert into public.activities(lead_id, actor_id, kind, text) values (lid, auth.uid(), 'created', 'Added by the telecaller after a phone call');
  end if;
  return public.log_phone_call(p_phone, p_direction, p_started_at, p_duration, p_external_id);
end $$;
revoke execute on function public.add_call_lead(text, text, text, timestamptz, int, text) from anon, public;
grant execute on function public.add_call_lead(text, text, text, timestamptz, int, text) to authenticated;
