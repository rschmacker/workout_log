-- Migration (TODO item 7d): invite-only accounts.
-- Run once in Supabase: SQL Editor -> New query -> paste this file -> Run.
-- Safe to run again. supabase/schema.sql contains the same for new setups.
--
-- Only email addresses on this list can create an account - even if "Allow new users to
-- sign up" is switched on by mistake. (Keep that switch off anyway; this is a second lock.)
-- The list can't be read or changed through the app, only here in the SQL editor.
-- To let someone in, see supabase/README.md ("Adding a person").

create table if not exists public.allowed_emails (
  email text primary key check (email = lower(trim(email))),
  added_at timestamptz not null default now()
);

-- Not reachable through the app's API at all (no grants, RLS on, no policies)
revoke all on public.allowed_emails from anon, authenticated;
alter table public.allowed_emails enable row level security;

-- Everyone who already has an account stays allowed
insert into public.allowed_emails (email)
select lower(trim(u.email)) from auth.users u
where u.email is not null and trim(u.email) <> ''
on conflict (email) do nothing;

-- Checked whenever a new account is about to be created. Runs with full rights
-- because nobody is logged in during sign-up; it only reads the list.
create or replace function public.check_allowed_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is null or not exists (
    select 1 from public.allowed_emails a where a.email = lower(trim(new.email))
  ) then
    raise exception 'Sign-ups are invite-only. Ask the owner of the app to add your email address.';
  end if;
  return new;
end $$;

drop trigger if exists check_allowed_email on auth.users;
create trigger check_allowed_email before insert on auth.users
  for each row execute function public.check_allowed_email();

-- How many addresses are on the list now (should be 3)
select count(*) as allowed_email_addresses from public.allowed_emails;
