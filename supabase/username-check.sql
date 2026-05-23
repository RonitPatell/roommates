-- Optional: run in Supabase SQL Editor if you want the username RPC helper.
-- Sign-up no longer depends on a pre-check from the app.

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
