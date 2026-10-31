-- Pipsqueak: per-user projects and settings.

create table public.projects (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index projects_user_created_idx on public.projects (user_id, created_at desc);

create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  active_project_id text,
  updated_at timestamptz not null default now()
);

-- Keep updated_at current on every update.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

-- Row level security: users can only see and change their own rows.
alter table public.projects enable row level security;
alter table public.user_settings enable row level security;

create policy "Users read own projects" on public.projects
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own projects" on public.projects
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own projects" on public.projects
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own projects" on public.projects
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users read own settings" on public.user_settings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own settings" on public.user_settings
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own settings" on public.user_settings
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own settings" on public.user_settings
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Signed-out visitors get no access at all.
revoke all on public.projects, public.user_settings from anon;
grant select, insert, update, delete on public.projects, public.user_settings to authenticated;
