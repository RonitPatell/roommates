-- Run this ONLY if you already ran the base schema and only need the Nudge feature.
-- Supabase Dashboard → SQL → New query → paste and run.

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
