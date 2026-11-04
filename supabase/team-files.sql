-- Dialbook Pro – photos and files in team chat (website and phone app).
-- Run once in Supabase → SQL Editor, after team-chat.sql. Safe to run again.
--
-- Files go into a PRIVATE storage bucket "team-files", in a folder per conversation ("team", or "dm_<id>_<id>" for a
-- private chat). Only people who can read that conversation can upload to it or open its files; links to a file work
-- for one hour. Up to 10 MB per file. The person who sent a file, or an admin, can delete it.

alter table public.team_messages add column if not exists file jsonb;   -- {path, name, type, size}

insert into storage.buckets (id, name, public, file_size_limit)
values ('team-files', 'team-files', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = 10485760;

-- The conversation a file belongs to, from its folder ("dm_a_b" → "dm:a:b")
create or replace function public.team_file_ok(p_name text) returns boolean
language sql stable as $$ select public.team_can(replace(split_part(p_name, '/', 1), '_', ':')) $$;

drop policy if exists team_files_insert on storage.objects;
create policy team_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'team-files' and public.team_file_ok(name));
drop policy if exists team_files_select on storage.objects;
create policy team_files_select on storage.objects for select to authenticated
  using (bucket_id = 'team-files' and public.team_file_ok(name));
drop policy if exists team_files_delete on storage.objects;
create policy team_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'team-files' and (owner = auth.uid() or public.is_admin()));

notify pgrst, 'reload schema';
