-- Conflict-safe saving, version history in its own column, share links and
-- comments. Everything here is additive, so the previous app keeps working.

-- ---------- Revisions ----------
-- Every update bumps rev. The app sends the rev it last saw and gets no row
-- back when another tab or device saved in between, instead of overwriting it.
alter table public.projects add column rev bigint not null default 1;

-- Screens' version history, keyed by screen id: { "<screen id>": [version, …] }.
-- It's kept out of `data` so everyday saves and the sign-in load skip it.
alter table public.projects add column versions jsonb;

create function public.bump_project_rev()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Maintenance updates (like moving history out of `data`) set this so open
  -- tabs don't see a change that isn't one.
  if coalesce(current_setting('pipsqueak.keep_rev', true), '') <> 'on' then
    new.rev = old.rev + 1;
  end if;
  return new;
end;
$$;

create trigger projects_bump_rev
  before update on public.projects
  for each row execute function public.bump_project_rev();

-- ---------- Share links ----------
-- kind 'link' is the public share link; kind 'device' is the short-lived link
-- behind "Preview on your phone".
create table public.shares (
  token text primary key default replace(gen_random_uuid()::text, '-', ''),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id text not null,
  kind text not null default 'link' check (kind in ('link', 'device')),
  allow_comments boolean not null default false,
  allow_remix boolean not null default false,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, project_id, kind),
  foreign key (user_id, project_id) references public.projects (user_id, id) on delete cascade
);

alter table public.shares enable row level security;

create policy "Users read own shares" on public.shares
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users create own shares" on public.shares
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own shares" on public.shares
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own shares" on public.shares
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.shares from anon;
grant select, insert, delete on public.shares to authenticated;
grant update (allow_comments, allow_remix, expires_at) on public.shares to authenticated;

-- ---------- Comments ----------
-- user_id is the design's owner. Comments come from the owner in the studio
-- (source 'owner') or from people with a share link (source 'share').
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id text not null,
  screen_id text not null check (char_length(screen_id) between 1 and 64),
  anchor jsonb not null default '{}'::jsonb check (jsonb_typeof(anchor) = 'object' and pg_column_size(anchor) < 2048),
  body text not null check (char_length(body) between 1 and 1000),
  author_id uuid references auth.users (id) on delete set null,
  author_name text not null check (char_length(author_name) between 1 and 60),
  source text not null default 'owner' check (source in ('owner', 'share')),
  share_token text references public.shares (token) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text check (char_length(resolved_by) <= 60),
  foreign key (user_id, project_id) references public.projects (user_id, id) on delete cascade
);

create index comments_project_idx on public.comments (user_id, project_id, created_at);
create index comments_share_idx on public.comments (share_token, created_at);

alter table public.comments enable row level security;

create policy "Owners read comments on their designs" on public.comments
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners comment on their designs" on public.comments
  for insert to authenticated
  with check ((select auth.uid()) = user_id and source = 'owner' and author_id = (select auth.uid()) and share_token is null);
create policy "Owners update comments on their designs" on public.comments
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Owners delete comments on their designs" on public.comments
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.comments from anon;
grant select, insert, delete on public.comments to authenticated;
grant update (body, anchor, resolved_at, resolved_by) on public.comments to authenticated;

-- New comments from share links show up in the studio as they arrive.
alter publication supabase_realtime add table public.comments;

-- ---------- Share link functions (callable without signing in) ----------

-- A valid, unexpired share, or null.
create function public.live_share(p_token text)
returns public.shares
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.shares
  where token = p_token and (expires_at is null or expires_at > now())
$$;

revoke execute on function public.live_share(text) from public, anon, authenticated;

-- The shared design. Returns only { rev, unchanged } when the caller already
-- has this revision, so viewers can poll cheaply for live updates. Without
-- remixing, only what the prototype needs is returned; with it, the whole
-- design except the owner's chat, review, prompt and history.
create function public.get_share(p_token text, p_known_rev bigint default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.shares;
  p public.projects;
  owner_name text;
  screens jsonb;
  body jsonb;
begin
  s := public.live_share(p_token);
  if s.token is null then
    return null;
  end if;
  select * into p from public.projects where user_id = s.user_id and id = s.project_id;
  if not found then
    return null;
  end if;
  if p_known_rev is not null and p.rev = p_known_rev then
    return jsonb_build_object('rev', p.rev, 'unchanged', true);
  end if;
  select display_name into owner_name from public.profiles where id = s.user_id;

  if s.allow_remix and s.kind = 'link' then
    select coalesce(jsonb_agg(sc - 'versions' - 'findings' order by ord), '[]'::jsonb) into screens
    from jsonb_array_elements(coalesce(p.data -> 'screens', '[]'::jsonb)) with ordinality as t(sc, ord);
    body := (p.data - 'chat' - 'review' - 'prompt' - 'fav' - 'remixOf') || jsonb_build_object('screens', screens);
  else
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', sc -> 'id', 'name', sc -> 'name', 'html', sc -> 'html', 'status', sc -> 'status', 'inNav', sc -> 'inNav'
    ) order by ord), '[]'::jsonb) into screens
    from jsonb_array_elements(coalesce(p.data -> 'screens', '[]'::jsonb)) with ordinality as t(sc, ord);
    body := jsonb_build_object(
      'name', p.data -> 'name',
      'kind', p.data -> 'kind',
      'tagline', p.data -> 'tagline',
      'platform', p.data -> 'platform',
      'spec', jsonb_build_object('platform', p.data -> 'spec' -> 'platform'),
      'system', p.data -> 'system',
      'kit', p.data -> 'kit',
      'screens', screens
    );
  end if;

  return jsonb_build_object(
    'rev', p.rev,
    'kind', s.kind,
    'allowComments', s.allow_comments and s.kind = 'link',
    'allowRemix', s.allow_remix and s.kind = 'link',
    'owner', coalesce(nullif(trim(owner_name), ''), 'A Pipsqueak designer'),
    'project', body || jsonb_build_object('id', p.id)
  );
end;
$$;

revoke execute on function public.get_share(text, bigint) from public;
grant execute on function public.get_share(text, bigint) to anon, authenticated;

-- Open comments left through this link. The owner's own notes stay private.
create function public.get_share_comments(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.shares;
begin
  s := public.live_share(p_token);
  if s.token is null or not s.allow_comments or s.kind <> 'link' then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'screenId', c.screen_id, 'anchor', c.anchor, 'body', c.body,
      'author', c.author_name, 'at', c.created_at
    ) order by c.created_at)
    from public.comments c
    where c.share_token = s.token and c.resolved_at is null
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.get_share_comments(text) from public;
grant execute on function public.get_share_comments(text) to anon, authenticated;

-- Leaves a comment through a share link that allows comments.
create function public.add_share_comment(p_token text, p_screen_id text, p_anchor jsonb, p_body text, p_author text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s public.shares;
  body text := trim(coalesce(p_body, ''));
  author text := left(coalesce(nullif(trim(p_author), ''), 'Guest'), 60);
  c public.comments;
begin
  s := public.live_share(p_token);
  if s.token is null or not s.allow_comments or s.kind <> 'link' then
    raise exception 'Comments are turned off for this link.' using errcode = '42501';
  end if;
  if char_length(body) = 0 then
    raise exception 'Write something first.' using errcode = '22023';
  end if;
  if char_length(body) > 1000 then
    raise exception 'Keep comments under 1,000 characters.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.projects p, jsonb_array_elements(coalesce(p.data -> 'screens', '[]'::jsonb)) sc
    where p.user_id = s.user_id and p.id = s.project_id and sc ->> 'id' = p_screen_id
  ) then
    raise exception 'That screen no longer exists.' using errcode = '22023';
  end if;
  if (select count(*) from public.comments where share_token = s.token and created_at > now() - interval '10 minutes') >= 30 then
    raise exception 'Lots of comments just now. Try again in a few minutes.' using errcode = '54000';
  end if;
  if (select count(*) from public.comments where user_id = s.user_id and project_id = s.project_id and resolved_at is null) >= 300 then
    raise exception 'This design has too many open comments right now.' using errcode = '54000';
  end if;

  insert into public.comments (user_id, project_id, screen_id, anchor, body, author_id, author_name, source, share_token)
  values (s.user_id, s.project_id, p_screen_id, coalesce(p_anchor, '{}'::jsonb), body, auth.uid(), author, 'share', s.token)
  returning * into c;

  return jsonb_build_object(
    'id', c.id, 'screenId', c.screen_id, 'anchor', c.anchor, 'body', c.body,
    'author', c.author_name, 'at', c.created_at
  );
end;
$$;

revoke execute on function public.add_share_comment(text, text, jsonb, text, text) from public;
grant execute on function public.add_share_comment(text, text, jsonb, text, text) to anon, authenticated;
