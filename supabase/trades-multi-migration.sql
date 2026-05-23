-- Multi-chore trades: run once in Supabase SQL editor

alter table public.trade_offers
  add column if not exists offered_chore_ids uuid[],
  add column if not exists requested_chore_ids uuid[];

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'trade_offers'
      and column_name = 'offered_chore_id'
  ) then
    update public.trade_offers
    set
      offered_chore_ids = coalesce(offered_chore_ids, array[offered_chore_id]),
      requested_chore_ids = coalesce(requested_chore_ids, array[requested_chore_id])
    where offered_chore_ids is null or requested_chore_ids is null;

    alter table public.trade_offers drop column offered_chore_id;
    alter table public.trade_offers drop column requested_chore_id;
  end if;
end $$;

update public.trade_offers
set
  offered_chore_ids = coalesce(offered_chore_ids, '{}'),
  requested_chore_ids = coalesce(requested_chore_ids, '{}')
where offered_chore_ids is null or requested_chore_ids is null;

alter table public.trade_offers
  alter column offered_chore_ids set not null,
  alter column requested_chore_ids set not null;

alter table public.trade_offers drop constraint if exists trade_offers_chore_counts;
alter table public.trade_offers add constraint trade_offers_chore_counts check (
  cardinality(offered_chore_ids) >= 1 and cardinality(requested_chore_ids) >= 1
);
