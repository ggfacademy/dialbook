-- Dialbook Pro – "enquired" date on every lead, for the Leads date filter.
-- Run once in Supabase → SQL Editor. Safe to run again.
--
-- When someone already in the CRM (for example from the imported old data) fills a form again,
-- the existing lead is updated instead of a new one being created, so its "added" date stays old.
-- last_enquiry_at is the date of the newest enquiry: when the lead was added, or enquired again.

alter table public.leads add column if not exists last_enquiry_at timestamptz;
alter table public.leads alter column last_enquiry_at set default now();

update public.leads l
   set last_enquiry_at = greatest(l.created_at, coalesce(
         (select max(a.created_at) from public.activities a where a.lead_id = l.id and a.kind = 'enquiry'), l.created_at))
 where l.last_enquiry_at is null;

create index if not exists leads_last_enquiry on public.leads(last_enquiry_at);

create or replace function public.activities_enquiry_at() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'enquiry' then
    update public.leads set last_enquiry_at = new.created_at where id = new.lead_id;
  end if;
  return new;
end $$;
drop trigger if exists activities_enquiry_at on public.activities;
create trigger activities_enquiry_at after insert on public.activities
  for each row execute function public.activities_enquiry_at();

notify pgrst, 'reload schema';
