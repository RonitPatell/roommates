-- Run in Supabase SQL Editor: allow household creator to delete their group

drop policy if exists "groups_delete_creator" on public.groups;

create policy "groups_delete_creator" on public.groups
  for delete
  using (auth.uid() = created_by);

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
