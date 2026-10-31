-- AI: run log (also used for daily quotas), taste profiles and generated artwork.

create table public.ai_runs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  model text,
  status text not null default 'running' check (status in ('running', 'ok', 'error')),
  cost smallint not null default 1,
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  error text,
  created_at timestamptz not null default now()
);

create index ai_runs_user_created_idx on public.ai_runs (user_id, created_at desc);

-- Users can read their own history. Only the Edge Function (service role)
-- writes to this table.
alter table public.ai_runs enable row level security;
create policy "Users read own AI runs" on public.ai_runs
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.ai_runs from anon;
grant select on public.ai_runs to authenticated;

-- Voice, audience and locale that personalise every AI request.
alter table public.profiles
  add column ai_taste jsonb not null default '{}'::jsonb
  check (pg_column_size(ai_taste) < 4096);

-- Generated images, stored under <user id>/<project id>/.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('artwork', 'artwork', true, 5242880, array['image/png', 'image/jpeg', 'image/webp']);

create policy "Users read own artwork files" on storage.objects
  for select to authenticated
  using (bucket_id = 'artwork' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users delete own artwork" on storage.objects
  for delete to authenticated
  using (bucket_id = 'artwork' and (storage.foldername(name))[1] = (select auth.uid())::text);
