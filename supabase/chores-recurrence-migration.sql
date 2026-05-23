-- Run in Supabase SQL Editor (adds multi-assign, recurrence, rotation)

alter table public.chores
  add column if not exists assignee_ids uuid[] not null default '{}',
  add column if not exists recurrence_type text not null default 'once',
  add column if not exists rotation_mode text not null default 'none',
  add column if not exists rotation_period text,
  add column if not exists series_id uuid;

-- If you already ran an older version with a foreign key on series_id, remove it:
alter table public.chores drop constraint if exists chores_series_id_fkey;

update public.chores
set assignee_ids = array[assigned_to]
where assignee_ids = '{}';

alter table public.chores
  drop constraint if exists chores_recurrence_type_check;

alter table public.chores
  add constraint chores_recurrence_type_check
  check (recurrence_type in ('once', 'daily', 'weekly', 'monthly'));

alter table public.chores
  drop constraint if exists chores_rotation_mode_check;

alter table public.chores
  add constraint chores_rotation_mode_check
  check (rotation_mode in ('none', 'random'));

alter table public.chores
  drop constraint if exists chores_rotation_period_check;

alter table public.chores
  add constraint chores_rotation_period_check
  check (rotation_period is null or rotation_period in ('day', 'week'));
