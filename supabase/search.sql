-- Dialbook Pro – search leads by course/tags, notes and source.
-- Run once in Supabase → SQL Editor. Safe to run again.
-- Keeps a plain-text copy of each lead's tags (where imported courses and Facebook form names are
-- stored) so the Leads search box can find them, and indexes it with the notes for fast searching.

create extension if not exists pg_trgm;
alter table public.leads add column if not exists tags_text text not null default '';

create or replace function public.leads_tags_text() returns trigger
language plpgsql as $$
begin
  new.tags_text := coalesce(array_to_string(new.tags, ' | '), '');
  return new;
end $$;
drop trigger if exists leads_tags_text on public.leads;
create trigger leads_tags_text before insert or update of tags on public.leads
  for each row execute function public.leads_tags_text();

update public.leads set tags_text = coalesce(array_to_string(tags, ' | '), '')
 where tags_text is distinct from coalesce(array_to_string(tags, ' | '), '');

create index if not exists leads_tags_trgm on public.leads using gin (tags_text gin_trgm_ops);
create index if not exists leads_note_trgm on public.leads using gin (note gin_trgm_ops);
create index if not exists leads_source_trgm on public.leads using gin (source gin_trgm_ops);

notify pgrst, 'reload schema';
