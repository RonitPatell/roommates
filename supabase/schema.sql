-- Run this in Supabase SQL Editor (Dashboard → SQL → New query)
-- Safe to re-run: policies are dropped before recreate. Tables use IF NOT EXISTS.
-- Already set up? Run only supabase/nudges-migration.sql for the Nudge feature.

create extension if not exists "pgcrypto";

-- Profiles (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text,
  accent_color text check (
    accent_color is null
    or accent_color in (
      '#F87171', '#FB923C', '#FBBF24', '#A3E635', '#34D399', '#22D3EE',
      '#60A5FA', '#A78BFA', '#F472B6', '#E879F9'
    )
  ),
  created_at timestamptz not null default now(),
  constraint username_format check (
    username ~ '^[a-z0-9_]{3,20}$'
  ),
  constraint username_unique unique (username)
);

create index if not exists profiles_username_idx on public.profiles (username);

-- Household groups
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.chores (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  title text not null,
  notes text,
  assigned_to uuid not null references public.profiles (id) on delete cascade,
  assignee_ids uuid[] not null default '{}',
  recurrence_type text not null default 'once' check (recurrence_type in ('once', 'daily', 'weekly', 'monthly')),
  rotation_mode text not null default 'none' check (rotation_mode in ('none', 'random')),
  rotation_period text check (rotation_period is null or rotation_period in ('day', 'week')),
  series_id uuid,
  due_date date not null,
  completed boolean not null default false,
  completed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.trade_offers (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  from_user_id uuid not null references public.profiles (id) on delete cascade,
  to_user_id uuid not null references public.profiles (id) on delete cascade,
  offered_chore_ids uuid[] not null,
  requested_chore_ids uuid[] not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  constraint trade_offers_chore_counts check (
    cardinality(offered_chore_ids) >= 1 and cardinality(requested_chore_ids) >= 1
  )
);

-- Auto-create profile on signup (username filled later)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(
      nullif(lower(trim(new.raw_user_meta_data->>'username')), ''),
      'user_' || substr(replace(new.id::text, '-', ''), 1, 12)
    ),
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      'New user'
    )
  );
  return new;
exception
  when unique_violation then
    raise exception 'Username is already taken';
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.chores enable row level security;
alter table public.trade_offers enable row level security;

create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

-- Profiles: read any (for username lookup), update/insert own
drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;

create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

-- Fast username availability check (optional; sign-up does not require a pre-check)
create or replace function public.is_username_available(uname text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles
    where username = lower(trim(uname))
  );
$$;

grant execute on function public.is_username_available(text) to anon, authenticated;

-- Groups
drop policy if exists "groups_select_member" on public.groups;
drop policy if exists "groups_insert_auth" on public.groups;
drop policy if exists "groups_update_owner" on public.groups;
drop policy if exists "groups_delete_creator" on public.groups;

create policy "groups_select_member" on public.groups for select using (public.is_group_member(id));
create policy "groups_insert_auth" on public.groups for insert with check (auth.uid() = created_by);
create policy "groups_update_owner" on public.groups for update using (
  exists (select 1 from public.group_members where group_id = id and user_id = auth.uid() and role = 'owner')
);
create policy "groups_delete_creator" on public.groups for delete using (auth.uid() = created_by);

-- Group members
drop policy if exists "gm_select" on public.group_members;
drop policy if exists "gm_insert" on public.group_members;
drop policy if exists "gm_delete" on public.group_members;

create policy "gm_select" on public.group_members for select using (public.is_group_member(group_id));
create policy "gm_insert" on public.group_members for insert with check (
  public.is_group_member(group_id) or auth.uid() = user_id
);
create policy "gm_delete" on public.group_members for delete using (
  auth.uid() = user_id or exists (
    select 1 from public.group_members gm
    where gm.group_id = group_members.group_id and gm.user_id = auth.uid() and gm.role = 'owner'
  )
);

-- Chores
drop policy if exists "chores_select" on public.chores;
drop policy if exists "chores_insert" on public.chores;
drop policy if exists "chores_update" on public.chores;
drop policy if exists "chores_delete" on public.chores;

create policy "chores_select" on public.chores for select using (public.is_group_member(group_id));
create policy "chores_insert" on public.chores for insert with check (public.is_group_member(group_id));
create policy "chores_update" on public.chores for update using (public.is_group_member(group_id));
create policy "chores_delete" on public.chores for delete using (public.is_group_member(group_id));

-- Trades
drop policy if exists "trades_select" on public.trade_offers;
drop policy if exists "trades_insert" on public.trade_offers;
drop policy if exists "trades_update" on public.trade_offers;

create policy "trades_select" on public.trade_offers for select using (public.is_group_member(group_id));
create policy "trades_insert" on public.trade_offers for insert with check (
  public.is_group_member(group_id) and auth.uid() = from_user_id
);
create policy "trades_update" on public.trade_offers for update using (
  public.is_group_member(group_id) and (auth.uid() = to_user_id or auth.uid() = from_user_id)
);

-- Allow new group creator to add themselves as owner
create or replace function public.create_group_with_owner(gname text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into public.groups (name, created_by) values (gname, auth.uid()) returning id into new_id;
  insert into public.group_members (group_id, user_id, role) values (new_id, auth.uid(), 'owner');
  return new_id;
end;
$$;

grant execute on function public.create_group_with_owner(text) to authenticated;

-- Creator permanently deletes a household (bypasses RLS so cascades succeed)
create or replace function public.delete_group_as_creator(gid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.groups g where g.id = gid and g.created_by = auth.uid()
  ) then
    raise exception 'Only the household creator can delete it';
  end if;

  delete from public.groups where id = gid;
end;
$$;

grant execute on function public.delete_group_as_creator(uuid) to authenticated;

create or replace function public.add_group_member_by_username(gid uuid, uname text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  if not exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'Only group owners can add members';
  end if;

  select id into target_id from public.profiles where username = lower(trim(uname));
  if target_id is null then
    raise exception 'No user found with that username';
  end if;

  if exists (select 1 from public.group_members where group_id = gid and user_id = target_id) then
    raise exception 'User is already in this group';
  end if;

  insert into public.group_members (group_id, user_id, role) values (gid, target_id, 'member');
end;
$$;

grant execute on function public.add_group_member_by_username(uuid, text) to authenticated;

-- Anonymous "lock in" nudges between group members (sender never exposed to recipients)
create table if not exists public.lock_in_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint lock_in_body_length check (char_length(trim(body)) between 1 and 500)
);

create index if not exists lock_in_messages_inbox_idx
  on public.lock_in_messages (group_id, recipient_id, created_at desc);

alter table public.lock_in_messages enable row level security;

-- All access via security definer RPCs so recipient queries never see sender_id

create or replace function public.send_lock_in_message(
  p_group_id uuid,
  p_recipient_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  trimmed text;
  recent_count int;
begin
  trimmed := trim(p_body);
  if char_length(trimmed) < 1 or char_length(trimmed) > 500 then
    raise exception 'Message must be between 1 and 500 characters';
  end if;

  if not public.is_group_member(p_group_id) then
    raise exception 'Not a member of this group';
  end if;

  if p_recipient_id = auth.uid() then
    raise exception 'You cannot nudge yourself';
  end if;

  if not exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_recipient_id
  ) then
    raise exception 'Recipient is not in this group';
  end if;

  select count(*)::int into recent_count
  from public.lock_in_messages
  where group_id = p_group_id
    and sender_id = auth.uid()
    and recipient_id = p_recipient_id
    and created_at > now() - interval '24 hours';

  if recent_count >= 5 then
    raise exception 'Daily limit reached for this roommate (5 nudges per day)';
  end if;

  insert into public.lock_in_messages (group_id, recipient_id, sender_id, body)
  values (p_group_id, p_recipient_id, auth.uid(), trimmed)
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.get_lock_in_inbox(p_group_id uuid)
returns table (
  id uuid,
  group_id uuid,
  body text,
  created_at timestamptz,
  read_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select m.id, m.group_id, m.body, m.created_at, m.read_at
  from public.lock_in_messages m
  where m.group_id = p_group_id
    and m.recipient_id = auth.uid()
    and public.is_group_member(p_group_id)
  order by m.created_at desc
  limit 100;
$$;

create or replace function public.mark_lock_in_read(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.lock_in_messages
  set read_at = now()
  where id = p_message_id
    and recipient_id = auth.uid()
    and read_at is null;
end;
$$;

grant execute on function public.send_lock_in_message(uuid, uuid, text) to authenticated;
grant execute on function public.get_lock_in_inbox(uuid) to authenticated;
grant execute on function public.mark_lock_in_read(uuid) to authenticated;

-- Carry-over rotation + household points (see carry-over-points-migration.sql)
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

create table if not exists public.household_points (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  points int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

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

-- Roommate reviews: run supabase/roommate-reviews-migration.sql on existing projects.
-- Household invites: run supabase/household-invites-migration.sql on existing projects.
