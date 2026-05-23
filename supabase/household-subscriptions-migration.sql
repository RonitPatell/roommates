-- Household-level subscription (one purchase unlocks the whole group).
-- Run in Supabase SQL Editor after schema.sql.

create table if not exists public.household_subscriptions (
  group_id uuid primary key references public.groups (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  product_id text,
  store text check (store in ('app_store', 'play_store', 'stripe', 'promo', 'dev')),
  expires_at timestamptz,
  revenuecat_app_user_id text,
  updated_at timestamptz not null default now()
);

create index if not exists household_subscriptions_expires_idx
  on public.household_subscriptions (expires_at)
  where status = 'active';

alter table public.household_subscriptions enable row level security;

-- Members can read their household subscription status.
create policy household_subscriptions_select on public.household_subscriptions
  for select
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = household_subscriptions.group_id
        and gm.user_id = auth.uid()
    )
  );

-- Members can upsert while purchasing (client sync after RevenueCat).
-- Tighten with Edge Function + webhook in production if needed.
create policy household_subscriptions_upsert on public.household_subscriptions
  for insert
  with check (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = household_subscriptions.group_id
        and gm.user_id = auth.uid()
    )
  );

create policy household_subscriptions_update on public.household_subscriptions
  for update
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = household_subscriptions.group_id
        and gm.user_id = auth.uid()
    )
  );

create or replace function public.is_household_pro(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_subscriptions hs
    where hs.group_id = p_group_id
      and hs.status = 'active'
      and (hs.expires_at is null or hs.expires_at > now())
  );
$$;

grant execute on function public.is_household_pro(uuid) to authenticated;

create or replace function public.upsert_household_subscription(
  p_group_id uuid,
  p_product_id text default null,
  p_store text default null,
  p_expires_at timestamptz default null,
  p_revenuecat_app_user_id text default null
)
returns public.household_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.household_subscriptions;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id and gm.user_id = auth.uid()
  ) then
    raise exception 'Not a member of this household';
  end if;

  insert into public.household_subscriptions (
    group_id,
    status,
    product_id,
    store,
    expires_at,
    revenuecat_app_user_id,
    updated_at
  )
  values (
    p_group_id,
    'active',
    p_product_id,
    p_store,
    p_expires_at,
    p_revenuecat_app_user_id,
    now()
  )
  on conflict (group_id) do update set
    status = 'active',
    product_id = coalesce(excluded.product_id, household_subscriptions.product_id),
    store = coalesce(excluded.store, household_subscriptions.store),
    expires_at = coalesce(excluded.expires_at, household_subscriptions.expires_at),
    revenuecat_app_user_id = coalesce(
      excluded.revenuecat_app_user_id,
      household_subscriptions.revenuecat_app_user_id
    ),
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.upsert_household_subscription(uuid, text, text, timestamptz, text)
  to authenticated;
