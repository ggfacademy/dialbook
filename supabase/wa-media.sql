-- Dialbook Pro – files to send in WhatsApp chats (brochures, certificate samples, posters…).
-- Run once in Supabase → SQL Editor. Safe to run again.
--
-- A public storage bucket "wa-media": WhatsApp needs a public https link to each file it delivers, so anyone with a
-- file's link can open it. Put only material meant for customers here, never ID proofs or payment screenshots.
-- Team members can upload and see the list; managers and admins can delete.

insert into storage.buckets (id, name, public)
values ('wa-media', 'wa-media', true)
on conflict (id) do update set public = true;

drop policy if exists wa_media_insert on storage.objects;
create policy wa_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'wa-media' and public.is_active());
drop policy if exists wa_media_select on storage.objects;
create policy wa_media_select on storage.objects for select to authenticated
  using (bucket_id = 'wa-media' and public.is_active());
drop policy if exists wa_media_delete on storage.objects;
create policy wa_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'wa-media' and public.is_mgr());
