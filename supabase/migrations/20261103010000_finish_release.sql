-- Apply after the app that ships with 20261103000000 is live: the previous
-- app uploads artwork directly and reads history from inside `data`.

-- ---------- Artwork uploads only through the Edge Function ----------
-- Images reach the public artwork bucket only through one-time upload slots
-- the Edge Function creates after it paints an image, so the bucket can't be
-- used to host arbitrary files.
drop policy if exists "Users upload own artwork" on storage.objects;

update storage.buckets
set allowed_mime_types = array['image/webp'], file_size_limit = 2097152
where id = 'artwork';

-- ---------- Move history out of `data` ----------
-- Designs not saved since history got its own column still carry it inline.
-- History already in the column wins for screens that have both. Open tabs
-- aren't told about this change (it isn't one), so rev stays as it is.
set local pipsqueak.keep_rev = 'on';

update public.projects p
set
  versions = coalesce((
    select jsonb_object_agg(sc ->> 'id', sc -> 'versions')
    from jsonb_array_elements(coalesce(p.data -> 'screens', '[]'::jsonb)) sc
    where jsonb_typeof(sc -> 'versions') = 'array' and jsonb_array_length(sc -> 'versions') > 0
  ), '{}'::jsonb) || coalesce(p.versions, '{}'::jsonb),
  data = jsonb_set(p.data, '{screens}', (
    select coalesce(jsonb_agg(sc - 'versions' order by ord), '[]'::jsonb)
    from jsonb_array_elements(coalesce(p.data -> 'screens', '[]'::jsonb)) with ordinality as t(sc, ord)
  ))
where exists (
  select 1 from jsonb_array_elements(coalesce(p.data -> 'screens', '[]'::jsonb)) sc where sc ? 'versions'
);
