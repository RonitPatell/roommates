-- Run this if adding chores fails with a series_id / foreign key error.

alter table public.chores drop constraint if exists chores_series_id_fkey;

alter table public.chores
  add column if not exists assignee_ids uuid[] not null default '{}',
  add column if not exists recurrence_type text not null default 'once',
  add column if not exists rotation_mode text not null default 'none',
  add column if not exists rotation_period text,
  add column if not exists series_id uuid;

update public.chores
set assignee_ids = array[assigned_to]
where assignee_ids = '{}';
