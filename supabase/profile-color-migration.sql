-- Run in Supabase SQL Editor: per-user calendar / UI accent color

alter table public.profiles
  add column if not exists accent_color text;

alter table public.profiles
  drop constraint if exists profiles_accent_color_palette;

alter table public.profiles
  add constraint profiles_accent_color_palette check (
    accent_color is null
    or accent_color in (
      '#F87171', '#FB923C', '#FBBF24', '#A3E635', '#34D399', '#22D3EE',
      '#60A5FA', '#A78BFA', '#F472B6', '#E879F9'
    )
  );
