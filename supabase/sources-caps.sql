-- Dialbook Pro – lead sources always in CAPITAL letters (INTERAKT, FACEBOOK – GOLD APPRAISAL TRAINING, PHONE CALL …).
-- Run once in Supabase → SQL Editor. Safe to run again.
--
-- Every lead's source is saved in capitals, whichever way it comes in (Facebook, Interakt, imports, the phone app,
-- typed by hand), so "Facebook" and "FACEBOOK" are one source on the dashboard and in the Leads filter.

create or replace function public.leads_source_upper() returns trigger
language plpgsql as $$
begin
  new.source := upper(btrim(new.source));
  return new;
end $$;
drop trigger if exists a_leads_source_upper on public.leads;
create trigger a_leads_source_upper before insert or update of source on public.leads
  for each row when (new.source is not null) execute function public.leads_source_upper();

-- Existing leads
update public.leads set source = upper(btrim(source)) where source is distinct from upper(btrim(source));

-- "Personal number": only for leads the phone app added from an unknown incoming call
create or replace function public.mark_personal(p_lead uuid) returns void
language plpgsql security definer set search_path = public as $$
declare l public.leads;
begin
  select * into l from public.leads where id = p_lead;
  if not found then raise exception 'lead not found'; end if;
  if not (l.assigned_to = auth.uid() or l.created_by = auth.uid() or public.is_mgr()) then raise exception 'not your lead'; end if;
  if upper(l.source) <> 'INCOMING CALL' then
    raise exception 'only leads added from an unknown incoming call can be marked personal';
  end if;
  insert into public.personal_numbers(owner_id, phone_key)
  values (coalesce(l.created_by, auth.uid()), l.phone_key) on conflict do nothing;
  delete from public.leads where id = l.id;
end $$;

-- What the sources look like now:
select source, count(*) as leads from public.leads group by source order by leads desc;
