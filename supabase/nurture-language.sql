-- Dialbook Pro – nurture sequences by language and city (upgrade for an existing nurture.sql install).
-- Run once in Supabase → SQL Editor. Safe to run again.
alter table public.nurture_sequences add column if not exists language text not null default '';
alter table public.nurture_sequences add column if not exists cities text not null default '';   -- '' = any; else "Chennai, Coimbatore"
alter table public.nurture_sequences add column if not exists address text not null default '';  -- venue, usable as {address}

-- Enrol new leads in the best matching active sequence. Score: program 4, language 2, city 1, so the
-- most specific sequence wins (program + language + city first, "any/any/any" last). When a lead's
-- program, language or city changes before its first message went out, it is moved to the better match.
drop function if exists public.nurture_best(uuid, text);
create or replace function public.nurture_city_match(p_cities text, p_city text) returns boolean
language sql immutable as $$
  select coalesce(trim(p_cities), '') = '' or exists (
    select 1 from unnest(string_to_array(lower(p_cities), ',')) c
     where trim(c) <> '' and position(trim(c) in lower(coalesce(p_city, ''))) > 0)
$$;
create or replace function public.nurture_best(p_campaign uuid, p_language text, p_city text) returns uuid
language sql stable security definer set search_path = public as $$
  select s.id from public.nurture_sequences s
   where s.active and s.auto_enroll and jsonb_array_length(s.steps) > 0
     and (s.campaign_id is null or s.campaign_id = p_campaign)
     and (s.language = '' or lower(s.language) = lower(coalesce(p_language, '')))
     and public.nurture_city_match(s.cities, p_city)
   order by (s.campaign_id is not null)::int * 4 + (s.language <> '')::int * 2 + (trim(s.cities) <> '')::int desc, s.created_at
   limit 1
$$;

create or replace function public.nurture_auto_enroll() returns trigger
language plpgsql security definer set search_path = public as $$
declare best uuid; cur public.nurture_enrollments;
begin
  if new.dnd or new.stage in ('won','lost') then return new; end if;
  if tg_op = 'UPDATE' and new.campaign_id is not distinct from old.campaign_id
     and new.language is not distinct from old.language and new.city is not distinct from old.city then return new; end if;
  best := public.nurture_best(new.campaign_id, new.language, new.city);
  if best is null then return new; end if;
  select * into cur from public.nurture_enrollments e where e.lead_id = new.id and e.status = 'active' limit 1;
  if found then
    if cur.sequence_id = best or cur.last_sent_at is not null then return new; end if;
    delete from public.nurture_enrollments where id = cur.id;   -- nothing sent yet: switch to the better match
  end if;
  insert into public.nurture_enrollments(sequence_id, lead_id, next_at)
  select s.id, new.id, public.nurture_first_at(s) from public.nurture_sequences s where s.id = best
  on conflict (sequence_id, lead_id) do nothing;
  return new;
end $$;
drop trigger if exists nurture_auto_enroll on public.leads;
create trigger nurture_auto_enroll after insert or update of campaign_id, language, city on public.leads
  for each row execute function public.nurture_auto_enroll();

-- Managers: enrol existing open leads of the sequence's program, language and cities (added in the last p_days days)
create or replace function public.nurture_enroll_existing(p_seq uuid, p_days int default 30) returns int
language plpgsql security definer set search_path = public as $$
declare s public.nurture_sequences; n int;
begin
  if not public.is_mgr() then raise exception 'not allowed'; end if;
  select * into s from public.nurture_sequences where id = p_seq;
  if not found then raise exception 'sequence not found'; end if;
  insert into public.nurture_enrollments(sequence_id, lead_id, next_at)
  select s.id, l.id, public.nurture_first_at(s) from public.leads l
   where not l.dnd and l.stage not in ('won','lost')
     and (s.campaign_id is null or l.campaign_id = s.campaign_id)
     and (s.language = '' or lower(l.language) = lower(s.language))
     and public.nurture_city_match(s.cities, l.city)
     and l.created_at > now() - make_interval(days => greatest(1, coalesce(p_days, 30)))
     and not exists (select 1 from public.nurture_enrollments e where e.lead_id = l.id and e.status = 'active')
  on conflict (sequence_id, lead_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.nurture_enroll_existing(uuid, int) to authenticated;

notify pgrst, 'reload schema';
