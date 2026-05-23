-- Run if reviews migration was applied earlier: require shared household to post a review

drop policy if exists "reviews_insert" on public.roommate_reviews;

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
