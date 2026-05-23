-- Run in Supabase SQL Editor: carry-over rotation + household points

-- Per rotating chore series (identified by chores.series_id)
create table if not exists public.chore_series_rotation (
  series_id uuid primary key,
  group_id uuid not null references public.groups (id) on delete cascade,
  assignee_queue uuid[] not null,
  anchor_date date not null,
  rotation_period text not null default 'day' check (rotation_period in ('day', 'week')),
  rotation_lag int not null default 0 check (rotation_lag >= 0),
  last_processed_date date,
  updated_at timestamptz not null default now()
);

create index if not exists chore_series_rotation_group_idx
  on public.chore_series_rotation (group_id);

-- Current point totals per roommate in a household
create table if not exists public.household_points (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  points int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- Idempotent scoring ledger (one row per series/day/reason)
create table if not exists public.point_ledger (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  series_id uuid not null,
  due_date date not null,
  delta int not null check (delta in (-1, 1)),
  reason text not null check (reason in ('on_time', 'missed')),
  created_at timestamptz not null default now(),
  unique (series_id, due_date, reason)
);

create index if not exists point_ledger_group_idx on public.point_ledger (group_id);

alter table public.chore_series_rotation enable row level security;
alter table public.household_points enable row level security;
alter table public.point_ledger enable row level security;

drop policy if exists "csr_select" on public.chore_series_rotation;
drop policy if exists "csr_all_member" on public.chore_series_rotation;

create policy "csr_select" on public.chore_series_rotation
  for select using (public.is_group_member(group_id));

create policy "csr_all_member" on public.chore_series_rotation
  for all using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

drop policy if exists "hp_select" on public.household_points;
drop policy if exists "hp_all_member" on public.household_points;

create policy "hp_select" on public.household_points
  for select using (public.is_group_member(group_id));

create policy "hp_all_member" on public.household_points
  for all using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

drop policy if exists "pl_select" on public.point_ledger;
drop policy if exists "pl_insert" on public.point_ledger;

create policy "pl_select" on public.point_ledger
  for select using (public.is_group_member(group_id));

create policy "pl_insert" on public.point_ledger
  for insert with check (public.is_group_member(group_id));

-- Apply a point change once per ledger key; upsert household_points
create or replace function public.apply_point_event(
  p_group_id uuid,
  p_user_id uuid,
  p_series_id uuid,
  p_due_date date,
  p_delta int,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ledger_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_group_member(p_group_id) then
    raise exception 'Not a group member';
  end if;
  if p_delta not in (-1, 1) or p_reason not in ('on_time', 'missed') then
    raise exception 'Invalid point event';
  end if;

  insert into public.point_ledger (group_id, user_id, series_id, due_date, delta, reason)
  values (p_group_id, p_user_id, p_series_id, p_due_date, p_delta, p_reason)
  on conflict (series_id, due_date, reason) do nothing
  returning id into v_ledger_id;

  if v_ledger_id is not null then
    insert into public.household_points (group_id, user_id, points)
    values (p_group_id, p_user_id, p_delta)
    on conflict (group_id, user_id)
    do update set
      points = household_points.points + p_delta,
      updated_at = now();
  end if;
end;
$$;

-- Upsert rotation row when creating a rotating chore series
create or replace function public.upsert_chore_series_rotation(
  p_series_id uuid,
  p_group_id uuid,
  p_assignee_queue uuid[],
  p_anchor_date date,
  p_rotation_period text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_group_member(p_group_id) then
    raise exception 'Not a group member';
  end if;

  insert into public.chore_series_rotation (
    series_id, group_id, assignee_queue, anchor_date, rotation_period
  )
  values (p_series_id, p_group_id, p_assignee_queue, p_anchor_date, p_rotation_period)
  on conflict (series_id) do update set
    assignee_queue = excluded.assignee_queue,
    anchor_date = excluded.anchor_date,
    rotation_period = excluded.rotation_period,
    updated_at = now();
end;
$$;

create or replace function public.bump_rotation_lag(
  p_series_id uuid,
  p_processed_through date
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  new_lag int;
begin
  update public.chore_series_rotation
  set
    rotation_lag = rotation_lag + 1,
    last_processed_date = p_processed_through,
    updated_at = now()
  where series_id = p_series_id
  returning rotation_lag into new_lag;

  return coalesce(new_lag, 0);
end;
$$;

create or replace function public.set_rotation_processed_through(
  p_series_id uuid,
  p_processed_through date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chore_series_rotation
  set last_processed_date = p_processed_through, updated_at = now()
  where series_id = p_series_id;
end;
$$;

create or replace function public.get_household_points(p_group_id uuid)
returns table (user_id uuid, points int)
language sql
security definer
stable
set search_path = public
as $$
  select hp.user_id, hp.points
  from public.household_points hp
  where hp.group_id = p_group_id
    and public.is_group_member(p_group_id);
$$;

grant execute on function public.apply_point_event(uuid, uuid, uuid, date, int, text) to authenticated;
grant execute on function public.upsert_chore_series_rotation(uuid, uuid, uuid[], date, text) to authenticated;
grant execute on function public.bump_rotation_lag(uuid, date) to authenticated;
grant execute on function public.set_rotation_processed_through(uuid, date) to authenticated;
grant execute on function public.get_household_points(uuid) to authenticated;
