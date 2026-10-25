-- Migration (TODO item 7c): a display name per user, shown as "by <name>" on workouts.
-- Run once in Supabase: SQL Editor -> New query -> paste this file -> Run.
-- Safe to run again. supabase/schema.sql contains the same for new setups.
--
-- Every signed-in user can read all names (only the names, no email addresses);
-- each user can only change their own name.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 40),
  updated_at timestamptz not null default now()
);

revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;

alter table public.profiles enable row level security;

drop policy if exists "Read all profiles" on public.profiles;
create policy "Read all profiles" on public.profiles
  for select to authenticated
  using (true);

drop policy if exists "Create own profile" on public.profiles;
create policy "Create own profile" on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

drop policy if exists "Update own profile" on public.profiles;
create policy "Update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- The first name a user gets: the name from GitHub, otherwise the part of the
-- email address before the @. Everyone can change it later in Settings.
create or replace function public.default_display_name(meta jsonb, email text) returns text
language sql immutable set search_path = '' as $$
  select left(coalesce(
    nullif(trim(meta->>'full_name'), ''),
    nullif(trim(meta->>'name'), ''),
    nullif(trim(meta->>'user_name'), ''),
    nullif(split_part(coalesce(email, ''), '@', 1), ''),
    'User'
  ), 40)
$$;

-- New users automatically get a profile. Runs with full rights, because at sign-up
-- time nobody is logged in yet; it only creates the new user's own profile.
create or replace function public.create_profile_for_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, public.default_display_name(new.raw_user_meta_data, new.email))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists create_profile_for_new_user on auth.users;
create trigger create_profile_for_new_user after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

-- Profiles for the users that already exist
insert into public.profiles (id, display_name)
select u.id, public.default_display_name(u.raw_user_meta_data, u.email)
from auth.users u
on conflict (id) do nothing;

-- Show which names were created (only visible to you here in the SQL editor)
select p.display_name, p.id from public.profiles p order by p.display_name;
