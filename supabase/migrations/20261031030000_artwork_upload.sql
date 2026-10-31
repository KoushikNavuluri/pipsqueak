-- The app resizes generated artwork in the browser and uploads it itself.
create policy "Users upload own artwork" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'artwork' and (storage.foldername(name))[1] = (select auth.uid())::text);
