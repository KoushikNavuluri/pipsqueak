-- Migration: Share analytics & screen heatmaps
alter table public.share_views add column if not exists screen_id text;
alter table public.share_views add column if not exists screen_name text;
alter table public.share_views add column if not exists dwell_ms integer default 0;

create or replace function public.record_share_view(
  p_token text,
  p_device text default 'desktop',
  p_referrer text default null,
  p_screen_id text default null,
  p_screen_name text default null,
  p_dwell_ms integer default 0
)
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
  insert into public.share_views (token, device, referrer, screen_id, screen_name, dwell_ms)
  values (s.token, dev, left(p_referrer, 255), p_screen_id, left(p_screen_name, 64), coalesce(p_dwell_ms, 0));
  return true;
end;
$$;

revoke execute on function public.record_share_view(text, text, text, text, text, integer) from public;
grant execute on function public.record_share_view(text, text, text, text, text, integer) to anon, authenticated;

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
  screen_stats jsonb;
begin
  select * into s from public.shares where token = p_token and (user_id = (select auth.uid()) or exists (
    select 1 from public.workspace_members wm
    join public.projects p on p.workspace_id = wm.workspace_id
    where p.id = s.project_id and wm.user_id = (select auth.uid())
  ));
  if s.token is null then
    return null;
  end if;

  select count(*),
         count(*) filter (where device = 'mobile'),
         count(*) filter (where device = 'tablet'),
         count(*) filter (where device = 'desktop'),
         max(created_at)
  into total_count, mobile_count, tablet_count, desktop_count, last_view
  from public.share_views
  where token = p_token;

  select coalesce(jsonb_agg(sub), '[]'::jsonb)
  into screen_stats
  from (
    select coalesce(screen_name, screen_id, 'Overview') as screen,
           count(*) as views,
           round(avg(coalesce(dwell_ms, 0)) / 1000.0, 1) as avg_seconds
    from public.share_views
    where token = p_token and screen_id is not null
    group by coalesce(screen_name, screen_id, 'Overview')
    order by count(*) desc
  ) sub;

  return jsonb_build_object(
    'total', coalesce(total_count, 0),
    'mobile', coalesce(mobile_count, 0),
    'tablet', coalesce(tablet_count, 0),
    'desktop', coalesce(desktop_count, 0),
    'lastViewed', last_view,
    'screens', screen_stats
  );
end;
$$;
