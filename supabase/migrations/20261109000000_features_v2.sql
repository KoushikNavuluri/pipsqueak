-- ============================================================================
-- Features V2: Previews, Threaded Comments, Share Controls & Stats,
--              Notifications, Workspaces, and Design Polls
-- ============================================================================

-- ---------- 1. Threaded Comments & Replies ----------
alter table public.comments add column if not exists parent_id uuid references public.comments(id) on delete cascade;
create index if not exists comments_parent_idx on public.comments(parent_id);

-- Update RLS for comments to allow replies from owner
drop policy if exists "Owners comment on their designs" on public.comments;
create policy "Owners comment on their designs" on public.comments
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and source = 'owner'
    and author_id = (select auth.uid())
    and share_token is null
  );

grant update (body, anchor, resolved_at, resolved_by, parent_id) on public.comments to authenticated;

-- ---------- 2. Share Controls & Passcode ----------
alter table public.shares add column if not exists passcode text check (passcode is null or (char_length(passcode) between 4 and 32));
grant update (allow_comments, allow_remix, expires_at, passcode) on public.shares to authenticated;

-- ---------- 3. Share Views Analytics ----------
create table if not exists public.share_views (
  id uuid primary key default gen_random_uuid(),
  token text not null references public.shares (token) on delete cascade,
  device text not null default 'desktop' check (device in ('desktop', 'mobile', 'tablet')),
  referrer text,
  created_at timestamptz not null default now()
);

create index if not exists share_views_token_idx on public.share_views(token, created_at);

alter table public.share_views enable row level security;
create policy "Owners read own share views" on public.share_views
  for select to authenticated
  using (exists (select 1 from public.shares s where s.token = share_views.token and s.user_id = (select auth.uid())));

grant select on public.share_views to authenticated;

-- Callable by anon/authenticated to record a visit
create or replace function public.record_share_view(p_token text, p_device text default 'desktop', p_referrer text default null)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s public.shares;
  dev text := case when p_device in ('mobile', 'tablet', 'desktop') then p_device else 'desktop' end;
begin
  select * into s from public.shares where token = p_token and (expires_at is null or expires_at > now());
  if s.token is null then
    return false;
  end if;
  insert into public.share_views (token, device, referrer)
  values (s.token, dev, left(p_referrer, 255));
  return true;
end;
$$;

revoke execute on function public.record_share_view(text, text, text) from public;
grant execute on function public.record_share_view(text, text, text) to anon, authenticated;

-- Callable by owner to get stats
create or replace function public.get_share_stats(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.shares;
  total_count bigint;
  mobile_count bigint;
  tablet_count bigint;
  desktop_count bigint;
  last_view timestamptz;
begin
  select * into s from public.shares where token = p_token and user_id = (select auth.uid());
  if s.token is null then
    return jsonb_build_object('total', 0, 'mobile', 0, 'tablet', 0, 'desktop', 0, 'lastViewed', null);
  end if;

  select
    count(*),
    count(*) filter (where device = 'mobile'),
    count(*) filter (where device = 'tablet'),
    count(*) filter (where device = 'desktop'),
    max(created_at)
  into total_count, mobile_count, tablet_count, desktop_count, last_view
  from public.share_views
  where token = p_token;

  return jsonb_build_object(
    'total', coalesce(total_count, 0),
    'mobile', coalesce(mobile_count, 0),
    'tablet', coalesce(tablet_count, 0),
    'desktop', coalesce(desktop_count, 0),
    'lastViewed', last_view
  );
end;
$$;

revoke execute on function public.get_share_stats(text) from public;
grant execute on function public.get_share_stats(text) to authenticated;

-- ---------- 4. Notifications & Alerts ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id text,
  type text not null default 'comment' check (type in ('comment', 'poll_vote', 'workspace_invite', 'system')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 500),
  link text check (link is null or char_length(link) <= 255),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications(user_id, read_at, created_at desc);

alter table public.notifications enable row level security;
create policy "Users manage own notifications" on public.notifications
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.notifications to authenticated;
alter publication supabase_realtime add table public.notifications;

-- ---------- 5. Team Workspaces ----------
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  email text not null check (char_length(email) between 3 and 100),
  role text not null default 'editor' check (role in ('owner', 'editor', 'commenter', 'viewer')),
  status text not null default 'accepted' check (status in ('pending', 'accepted')),
  invite_token text unique default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);

create index if not exists workspace_members_user_idx on public.workspace_members(user_id);
create index if not exists workspace_members_invite_idx on public.workspace_members(invite_token);

alter table public.workspace_members enable row level security;

-- Workspace membership helper (avoid recursion)
create or replace function public.is_workspace_member(p_workspace_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id
      and user_id = p_user_id
      and status = 'accepted'
  );
$$;

create or replace function public.workspace_member_role(p_workspace_id uuid, p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.workspace_members
  where workspace_id = p_workspace_id
    and user_id = p_user_id
    and status = 'accepted'
  limit 1;
$$;

-- Workspaces policies
create policy "Users read workspaces they belong to" on public.workspaces
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_workspace_member(id, (select auth.uid())));

create policy "Users create workspaces" on public.workspaces
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "Owners update workspaces" on public.workspaces
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Owners delete workspaces" on public.workspaces
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Workspace members policies
create policy "Members read workspace members" on public.workspace_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_workspace_member(workspace_id, (select auth.uid()))
    or exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid()))
  );

create policy "Owners and editors manage workspace members" on public.workspace_members
  for all to authenticated
  using (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = (select auth.uid())
    )
  );

grant select, insert, update, delete on public.workspaces to authenticated;
grant select, insert, update, delete on public.workspace_members to authenticated;

-- Add workspace_id to projects
alter table public.projects add column if not exists workspace_id uuid references public.workspaces (id) on delete set null;
create index if not exists projects_workspace_idx on public.projects(workspace_id);

-- Update projects policies to support workspaces
drop policy if exists "Users read own projects" on public.projects;
create policy "Users read own projects" on public.projects
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      workspace_id is not null
      and public.is_workspace_member(workspace_id, (select auth.uid()))
    )
  );

drop policy if exists "Users update own projects" on public.projects;
create policy "Users update own projects" on public.projects
  for update to authenticated
  using (
    user_id = (select auth.uid())
    or (
      workspace_id is not null
      and public.workspace_member_role(workspace_id, (select auth.uid())) in ('owner', 'editor')
    )
  )
  with check (
    user_id = (select auth.uid())
    or (
      workspace_id is not null
      and public.workspace_member_role(workspace_id, (select auth.uid())) in ('owner', 'editor')
    )
  );

-- Helper to accept invite
create or replace function public.accept_workspace_invite(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  m public.workspace_members;
  w public.workspaces;
  u_email text;
  u_id uuid := auth.uid();
begin
  if u_id is null then
    raise exception 'Sign in to accept this invitation.' using errcode = '42501';
  end if;

  select * into m from public.workspace_members where invite_token = p_token;
  if m.id is null then
    raise exception 'This invitation link is invalid or expired.' using errcode = '22023';
  end if;

  select * into w from public.workspaces where id = m.workspace_id;
  if w.id is null then
    raise exception 'This workspace no longer exists.' using errcode = '22023';
  end if;

  update public.workspace_members
  set user_id = u_id, status = 'accepted'
  where id = m.id;

  return jsonb_build_object(
    'workspaceId', w.id,
    'name', w.name,
    'role', m.role
  );
end;
$$;

revoke execute on function public.accept_workspace_invite(text) from public;
grant execute on function public.accept_workspace_invite(text) to authenticated;

-- ---------- 6. Design Variants Shared as Polls ----------
create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  token text unique not null default replace(gen_random_uuid()::text, '-', ''),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id text not null,
  title text not null check (char_length(title) between 1 and 100),
  question text not null default 'Which design do you prefer?' check (char_length(question) between 1 and 200),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) >= 2),
  show_results boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (user_id, project_id) references public.projects (user_id, id) on delete cascade
);

create index if not exists polls_token_idx on public.polls(token);
create index if not exists polls_project_idx on public.polls(user_id, project_id);

alter table public.polls enable row level security;

create policy "Users manage own polls" on public.polls
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.polls to authenticated;

create table if not exists public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  option_id text not null check (char_length(option_id) between 1 and 64),
  voter_key text not null check (char_length(voter_key) between 1 and 120),
  feedback text check (feedback is null or char_length(feedback) <= 500),
  created_at timestamptz not null default now(),
  unique (poll_id, voter_key)
);

create index if not exists poll_votes_poll_idx on public.poll_votes(poll_id, created_at);

alter table public.poll_votes enable row level security;
create policy "Owners read poll votes" on public.poll_votes
  for select to authenticated
  using (exists (select 1 from public.polls p where p.id = poll_votes.poll_id and p.user_id = (select auth.uid())));

grant select on public.poll_votes to authenticated;
alter publication supabase_realtime add table public.poll_votes;

-- Get poll details for voters
create or replace function public.get_poll(p_token text, p_voter_key text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p public.polls;
  prj public.projects;
  voted_opt text := null;
  tally jsonb;
  opt_votes jsonb;
  total_votes bigint;
  can_see_results boolean;
  is_owner boolean;
begin
  select * into p from public.polls where token = p_token and (expires_at is null or expires_at > now());
  if p.id is null then
    return null;
  end if;

  select * into prj from public.projects where user_id = p.user_id and id = p.project_id;
  is_owner := (auth.uid() is not null and auth.uid() = p.user_id);

  if p_voter_key is not null then
    select option_id into voted_opt from public.poll_votes where poll_id = p.id and voter_key = p_voter_key limit 1;
  end if;

  can_see_results := is_owner or p.show_results or (voted_opt is not null);

  select count(*) into total_votes from public.poll_votes where poll_id = p.id;

  if can_see_results then
    select coalesce(jsonb_object_agg(option_id, cnt), '{}'::jsonb) into opt_votes
    from (
      select option_id, count(*) as cnt
      from public.poll_votes
      where poll_id = p.id
      group by option_id
    ) t;
  else
    opt_votes := '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'id', p.id,
    'token', p.token,
    'title', p.title,
    'question', p.question,
    'options', p.options,
    'showResults', p.show_results,
    'expiresAt', p.expires_at,
    'system', prj.data -> 'system',
    'kit', prj.data -> 'kit',
    'hasVoted', voted_opt is not null,
    'votedOption', voted_opt,
    'totalVotes', total_votes,
    'voteCounts', opt_votes,
    'isOwner', is_owner
  );
end;
$$;

revoke execute on function public.get_poll(text, text) from public;
grant execute on function public.get_poll(text, text) to anon, authenticated;

-- Cast vote
create or replace function public.cast_poll_vote(p_token text, p_option_id text, p_voter_key text, p_feedback text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  p public.polls;
  f_text text := nullif(trim(p_feedback), '');
  total_votes bigint;
  opt_votes jsonb;
begin
  select * into p from public.polls where token = p_token and (expires_at is null or expires_at > now());
  if p.id is null then
    raise exception 'This poll is no longer active.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from jsonb_array_elements(p.options) opt where opt ->> 'id' = p_option_id
  ) then
    raise exception 'Invalid option selected.' using errcode = '22023';
  end if;

  insert into public.poll_votes (poll_id, option_id, voter_key, feedback)
  values (p.id, p_option_id, p_voter_key, left(f_text, 500))
  on conflict (poll_id, voter_key)
  do update set option_id = excluded.option_id, feedback = coalesce(excluded.feedback, public.poll_votes.feedback);

  -- Record in-app notification for owner
  insert into public.notifications (user_id, project_id, type, title, body, link)
  values (
    p.user_id,
    p.project_id,
    'poll_vote',
    'New vote on ' || p.title,
    'Someone voted for option ' || p_option_id || (case when f_text is not null then ': "' || left(f_text, 80) || '"' else '' end),
    '/app/p/' || p.project_id
  );

  select count(*) into total_votes from public.poll_votes where poll_id = p.id;
  select coalesce(jsonb_object_agg(option_id, cnt), '{}'::jsonb) into opt_votes
  from (
    select option_id, count(*) as cnt
    from public.poll_votes
    where poll_id = p.id
    group by option_id
  ) t;

  return jsonb_build_object(
    'ok', true,
    'totalVotes', total_votes,
    'voteCounts', opt_votes,
    'votedOption', p_option_id
  );
end;
$$;

revoke execute on function public.cast_poll_vote(text, text, text, text) from public;
grant execute on function public.cast_poll_vote(text, text, text, text) to anon, authenticated;

-- ---------- 7. Update get_share for Password Protection & Expiry ----------
drop function if exists public.get_share(text, bigint, text);
drop function if exists public.get_share(text, bigint);
create or replace function public.get_share(p_token text, p_known_rev bigint default null, p_passcode text default null)
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
  select * into s from public.shares where token = p_token and (expires_at is null or expires_at > now());
  if s.token is null then
    return null;
  end if;

  select * into p from public.projects where user_id = s.user_id and id = s.project_id;
  if not found then
    return null;
  end if;

  -- Password protection check
  if s.passcode is not null and (p_passcode is null or p_passcode <> s.passcode) then
    return jsonb_build_object(
      'token', s.token,
      'protected', true,
      'kind', s.kind,
      'title', p.data -> 'name'
    );
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
    'expiresAt', s.expires_at,
    'protected', false,
    'hasPasscode', s.passcode is not null,
    'owner', coalesce(nullif(trim(owner_name), ''), 'A Pipsqueak designer'),
    'project', body || jsonb_build_object('id', p.id)
  );
end;
$$;

-- Drop old 2-arg function if needed or overload
revoke execute on function public.get_share(text, bigint, text) from public;
grant execute on function public.get_share(text, bigint, text) to anon, authenticated;

-- Overload get_share for 2 args as well for backwards compatibility
create or replace function public.get_share(p_token text, p_known_rev bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.get_share(p_token, p_known_rev, null);
$$;

revoke execute on function public.get_share(text, bigint) from public;
grant execute on function public.get_share(text, bigint) to anon, authenticated;

-- ---------- 8. Update Comments RPC for Threading & Notifications ----------
create or replace function public.get_share_comments(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.shares;
begin
  select * into s from public.shares where token = p_token and (expires_at is null or expires_at > now());
  if s.token is null or not s.allow_comments or s.kind <> 'link' then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'parentId', c.parent_id, 'screenId', c.screen_id, 'anchor', c.anchor, 'body', c.body,
      'author', c.author_name, 'at', c.created_at, 'resolved', c.resolved_at is not null
    ) order by c.created_at)
    from public.comments c
    where (c.share_token = s.token or c.project_id = s.project_id)
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.get_share_comments(text) from public;
grant execute on function public.get_share_comments(text) to anon, authenticated;

drop function if exists public.add_share_comment(text, text, jsonb, text, text, uuid);
drop function if exists public.add_share_comment(text, text, jsonb, text, text);
create or replace function public.add_share_comment(
  p_token text,
  p_screen_id text,
  p_anchor jsonb,
  p_body text,
  p_author text,
  p_parent_id uuid default null
)
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
  parent_row public.comments;
  eff_screen_id text := p_screen_id;
  eff_anchor jsonb := coalesce(p_anchor, '{}'::jsonb);
begin
  select * into s from public.shares where token = p_token and (expires_at is null or expires_at > now());
  if s.token is null or not s.allow_comments or s.kind <> 'link' then
    raise exception 'Comments are turned off for this link.' using errcode = '42501';
  end if;
  if char_length(body) = 0 then
    raise exception 'Write something first.' using errcode = '22023';
  end if;
  if char_length(body) > 1000 then
    raise exception 'Keep comments under 1,000 characters.' using errcode = '22023';
  end if;

  if p_parent_id is not null then
    select * into parent_row from public.comments where id = p_parent_id and project_id = s.project_id;
    if parent_row.id is not null then
      eff_screen_id := coalesce(eff_screen_id, parent_row.screen_id);
      if eff_anchor = '{}'::jsonb then
        eff_anchor := parent_row.anchor;
      end if;
    end if;
  end if;

  insert into public.comments (user_id, project_id, screen_id, anchor, body, author_id, author_name, source, share_token, parent_id)
  values (s.user_id, s.project_id, eff_screen_id, eff_anchor, body, auth.uid(), author, 'share', s.token, p_parent_id)
  returning * into c;

  -- Create in-app notification for project owner
  insert into public.notifications (user_id, project_id, type, title, body, link)
  values (
    s.user_id,
    s.project_id,
    'comment',
    'Comment from ' || author,
    body,
    '/app/p/' || s.project_id
  );

  return jsonb_build_object(
    'id', c.id, 'parentId', c.parent_id, 'screenId', c.screen_id, 'anchor', c.anchor, 'body', c.body,
    'author', c.author_name, 'at', c.created_at
  );
end;
$$;

revoke execute on function public.add_share_comment(text, text, jsonb, text, text, uuid) from public;
grant execute on function public.add_share_comment(text, text, jsonb, text, text, uuid) to anon, authenticated;
