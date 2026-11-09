-- Images used in carousels: search picks, AI paintings and the user's own
-- photos. Only the carousel Edge Function writes here (with the service key);
-- files are public so slides render and export anywhere.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('carousel-media', 'carousel-media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Owners can list and delete their own files (account deletion cleans up).
drop policy if exists "Users read own carousel media" on storage.objects;
create policy "Users read own carousel media" on storage.objects
  for select to authenticated
  using (bucket_id = 'carousel-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users delete own carousel media" on storage.objects;
create policy "Users delete own carousel media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'carousel-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
