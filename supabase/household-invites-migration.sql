-- Run in Supabase SQL Editor: household join requests (invite → accept)

create table if not exists public.household_join_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  invited_user_id uuid not null references public.profiles (id) on delete cascade,
  invited_by uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create unique index if not exists household_join_requests_pending_uniq
  on public.household_join_requests (group_id, invited_user_id)
  where status = 'pending';

create index if not exists household_join_requests_invitee_idx
  on public.household_join_requests (invited_user_id, status);

alter table public.household_join_requests enable row level security;

drop policy if exists "hjr_select" on public.household_join_requests;
create policy "hjr_select" on public.household_join_requests
  for select using (
    auth.uid() = invited_user_id
    or auth.uid() = invited_by
    or exists (
      select 1 from public.groups g
      where g.id = group_id and g.created_by = auth.uid()
    )
  );

create or replace function public.send_household_invite(gid uuid, uname text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
  request_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'Only the household creator can send invites';
  end if;

  select id into target_id from public.profiles where username = lower(trim(uname));
  if target_id is null then
    raise exception 'No user found with that username';
  end if;

  if target_id = auth.uid() then
    raise exception 'You cannot invite yourself';
  end if;

  if exists (
    select 1 from public.group_members
    where group_id = gid and user_id = target_id
  ) then
    raise exception 'User is already in this household';
  end if;

  if exists (
    select 1 from public.household_join_requests
    where group_id = gid and invited_user_id = target_id and status = 'pending'
  ) then
    raise exception 'An invite is already pending for this user';
  end if;

  insert into public.household_join_requests (group_id, invited_user_id, invited_by)
  values (gid, target_id, auth.uid())
  returning id into request_id;

  return request_id;
end;
$$;

create or replace function public.respond_household_invite(
  p_request_id uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.household_join_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into req
  from public.household_join_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Invite not found';
  end if;

  if req.invited_user_id <> auth.uid() then
    raise exception 'Only the invited user can respond';
  end if;

  if req.status <> 'pending' then
    raise exception 'This invite is no longer pending';
  end if;

  if p_accept then
    insert into public.group_members (group_id, user_id, role)
    values (req.group_id, auth.uid(), 'member')
    on conflict do nothing;

    update public.household_join_requests
    set status = 'accepted', responded_at = now()
    where id = p_request_id;
  else
    update public.household_join_requests
    set status = 'declined', responded_at = now()
    where id = p_request_id;
  end if;
end;
$$;

create or replace function public.cancel_household_invite(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.household_join_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into req from public.household_join_requests where id = p_request_id;

  if not found then
    raise exception 'Invite not found';
  end if;

  if req.invited_by <> auth.uid() and not exists (
    select 1 from public.groups g where g.id = req.group_id and g.created_by = auth.uid()
  ) then
    raise exception 'Only the household creator can cancel this invite';
  end if;

  if req.status <> 'pending' then
    raise exception 'This invite is no longer pending';
  end if;

  update public.household_join_requests
  set status = 'cancelled', responded_at = now()
  where id = p_request_id;
end;
$$;

create or replace function public.get_pending_invites_for_me()
returns table (
  id uuid,
  group_id uuid,
  group_name text,
  invited_by uuid,
  inviter_username text,
  inviter_display_name text,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    r.id,
    r.group_id,
    g.name as group_name,
    r.invited_by,
    p.username as inviter_username,
    p.display_name as inviter_display_name,
    r.created_at
  from public.household_join_requests r
  join public.groups g on g.id = r.group_id
  join public.profiles p on p.id = r.invited_by
  where r.invited_user_id = auth.uid()
    and r.status = 'pending'
  order by r.created_at desc;
$$;

create or replace function public.get_pending_invites_for_group(p_group_id uuid)
returns table (
  id uuid,
  invited_user_id uuid,
  invitee_username text,
  invitee_display_name text,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    r.id,
    r.invited_user_id,
    p.username as invitee_username,
    p.display_name as invitee_display_name,
    r.created_at
  from public.household_join_requests r
  join public.profiles p on p.id = r.invited_user_id
  where r.group_id = p_group_id
    and r.status = 'pending'
    and exists (
      select 1 from public.group_members gm
      where gm.group_id = p_group_id
        and gm.user_id = auth.uid()
        and gm.role = 'owner'
    )
  order by r.created_at desc;
$$;

grant execute on function public.send_household_invite(uuid, text) to authenticated;
grant execute on function public.respond_household_invite(uuid, boolean) to authenticated;
grant execute on function public.cancel_household_invite(uuid) to authenticated;
grant execute on function public.get_pending_invites_for_me() to authenticated;
grant execute on function public.get_pending_invites_for_group(uuid) to authenticated;

-- Stop adding members directly; use send_household_invite instead.
create or replace function public.add_group_member_by_username(gid uuid, uname text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Direct adds are disabled. Send a household invite instead.';
end;
$$;
