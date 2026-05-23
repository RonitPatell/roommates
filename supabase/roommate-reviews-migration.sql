-- Run in Supabase SQL Editor: roommate reviews + public profile lookup

create table if not exists public.roommate_reviews (
  id uuid primary key default gen_random_uuid(),
  subject_user_id uuid not null references public.profiles (id) on delete cascade,
  reviewer_user_id uuid not null references public.profiles (id) on delete cascade,
  rating numeric(2, 1) not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roommate_reviews_rating_range check (
    rating >= 0.5
    and rating <= 5
    and (rating * 2) = trunc(rating * 2)
  ),
  constraint roommate_reviews_body_len check (
    char_length(trim(body)) >= 1
    and char_length(trim(body)) <= 2000
  ),
  constraint roommate_reviews_not_self check (subject_user_id <> reviewer_user_id),
  constraint roommate_reviews_unique_pair unique (subject_user_id, reviewer_user_id)
);

create index if not exists roommate_reviews_subject_idx
  on public.roommate_reviews (subject_user_id, created_at desc);

alter table public.roommate_reviews enable row level security;

drop policy if exists "reviews_select" on public.roommate_reviews;
drop policy if exists "reviews_insert" on public.roommate_reviews;
drop policy if exists "reviews_update_own" on public.roommate_reviews;
drop policy if exists "reviews_delete_own" on public.roommate_reviews;

create policy "reviews_select" on public.roommate_reviews
  for select using (auth.uid() is not null);

create policy "reviews_insert" on public.roommate_reviews
  for insert with check (
    auth.uid() = reviewer_user_id
    and auth.uid() <> subject_user_id
    and exists (
      select 1
      from public.group_members gm_me
      join public.group_members gm_them on gm_them.group_id = gm_me.group_id
      where gm_me.user_id = auth.uid()
        and gm_them.user_id = subject_user_id
    )
  );

create policy "reviews_update_own" on public.roommate_reviews
  for update using (auth.uid() = reviewer_user_id)
  with check (auth.uid() = reviewer_user_id);

create policy "reviews_delete_own" on public.roommate_reviews
  for delete using (auth.uid() = reviewer_user_id);

create or replace function public.upsert_roommate_review(
  p_subject_id uuid,
  p_rating numeric,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  trimmed text;
  review_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if auth.uid() = p_subject_id then
    raise exception 'You cannot review yourself';
  end if;
  if p_rating < 0.5 or p_rating > 5 or (p_rating * 2) <> trunc(p_rating * 2) then
    raise exception 'Rating must be between 0.5 and 5 in half-star steps';
  end if;

  trimmed := trim(p_body);
  if char_length(trimmed) < 1 or char_length(trimmed) > 2000 then
    raise exception 'Review must be between 1 and 2000 characters';
  end if;

  if not exists (select 1 from public.profiles where id = p_subject_id) then
    raise exception 'User not found';
  end if;

  if not exists (
    select 1
    from public.group_members gm_me
    join public.group_members gm_them on gm_them.group_id = gm_me.group_id
    where gm_me.user_id = auth.uid()
      and gm_them.user_id = p_subject_id
  ) then
    raise exception 'You can only review roommates in your household';
  end if;

  insert into public.roommate_reviews (subject_user_id, reviewer_user_id, rating, body)
  values (p_subject_id, auth.uid(), p_rating, trimmed)
  on conflict (subject_user_id, reviewer_user_id) do update set
    rating = excluded.rating,
    body = excluded.body,
    updated_at = now()
  returning id into review_id;

  return review_id;
end;
$$;

create or replace function public.lookup_profile_by_username(uname text)
returns table (
  id uuid,
  username text,
  display_name text,
  avg_rating numeric,
  review_count bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.display_name,
    coalesce(avg(r.rating), 0)::numeric(3, 2) as avg_rating,
    count(r.id)::bigint as review_count
  from public.profiles p
  left join public.roommate_reviews r on r.subject_user_id = p.id
  where p.username = lower(trim(uname))
    and auth.uid() is not null
  group by p.id, p.username, p.display_name;
$$;

create or replace function public.get_public_profile(p_user_id uuid)
returns table (
  id uuid,
  username text,
  display_name text,
  avg_rating numeric,
  review_count bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.id,
    p.username,
    p.display_name,
    coalesce(avg(r.rating), 0)::numeric(3, 2) as avg_rating,
    count(r.id)::bigint as review_count
  from public.profiles p
  left join public.roommate_reviews r on r.subject_user_id = p.id
  where p.id = p_user_id
    and auth.uid() is not null
  group by p.id, p.username, p.display_name;
$$;

create or replace function public.get_reviews_for_user(p_user_id uuid)
returns table (
  id uuid,
  rating numeric,
  body text,
  created_at timestamptz,
  updated_at timestamptz,
  reviewer_id uuid,
  reviewer_username text,
  reviewer_display_name text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    rv.id,
    rv.rating,
    rv.body,
    rv.created_at,
    rv.updated_at,
    rv.reviewer_user_id as reviewer_id,
    p.username as reviewer_username,
    p.display_name as reviewer_display_name
  from public.roommate_reviews rv
  join public.profiles p on p.id = rv.reviewer_user_id
  where rv.subject_user_id = p_user_id
    and auth.uid() is not null
  order by rv.created_at desc;
$$;

grant execute on function public.upsert_roommate_review(uuid, numeric, text) to authenticated;
grant execute on function public.lookup_profile_by_username(text) to authenticated;
grant execute on function public.get_public_profile(uuid) to authenticated;
grant execute on function public.get_reviews_for_user(uuid) to authenticated;
