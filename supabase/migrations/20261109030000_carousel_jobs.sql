-- Finished carousel generation steps (slides, photo picks) per variation run.
-- The carousel Edge Function writes them with the service key; the app reads
-- them back through the function to recover work after a reload.
create table if not exists public.carousel_jobs (
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id text not null,
  variant_id text not null,
  kind text not null check (kind in ('write', 'images')),
  run text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, project_id, variant_id, kind)
);

alter table public.carousel_jobs enable row level security;

drop policy if exists "Users read own carousel jobs" on public.carousel_jobs;
create policy "Users read own carousel jobs" on public.carousel_jobs
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke insert, update, delete on public.carousel_jobs from anon, authenticated;

-- Old runs are only useful for a little while.
create index if not exists carousel_jobs_created_at on public.carousel_jobs (created_at);
