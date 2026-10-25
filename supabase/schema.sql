-- Workout Log database schema
-- Paste this whole file into Supabase: SQL Editor -> New query -> Run.
-- It is safe to run again (it skips things that already exist).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Exercises: built-in defaults have user_id = null, custom ones belong to a user.
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  category text not null
    check (category in ('Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core')),
  created_at timestamptz not null default now(),
  -- No duplicate names per user (and none among the built-in ones)
  unique nulls not distinct (user_id, name)
);

-- One row per logged set.
create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  date date not null,
  set_number int not null check (set_number between 1 and 5),
  weight_kg numeric(6, 2) not null check (weight_kg >= 0),
  reps int not null check (reps > 0),
  created_at timestamptz not null default now(),
  -- Lets the app "upsert": saving set 2 of a day again overwrites it
  unique (user_id, exercise_id, date, set_number)
);

-- ---------------------------------------------------------------------------
-- Access: only logged-in users, never anonymous visitors
-- ---------------------------------------------------------------------------

revoke all on public.exercises, public.workout_sets from anon;
grant select, insert, update, delete on public.exercises, public.workout_sets to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security ((select auth.uid()) is the id of the logged-in user)
--   shared:  exercises (and workouts, below) - every signed-in user sees them
--   private: logged sets and notes - every user only sees and changes their own
-- ---------------------------------------------------------------------------

alter table public.exercises enable row level security;
alter table public.workout_sets enable row level security;

-- exercises: everyone sees all; only the creator of a custom exercise changes it
-- (until 2026-10-21 users only saw built-in and their own exercises)
drop policy if exists "Read built-in and own exercises" on public.exercises;
drop policy if exists "Read all exercises" on public.exercises;
create policy "Read all exercises" on public.exercises
  for select to authenticated
  using (true);

-- One shared list: no two exercises with the same name (ignoring upper/lower case)
create unique index if not exists exercises_name_unique on public.exercises (lower(name));

drop policy if exists "Create own exercises" on public.exercises;
create policy "Create own exercises" on public.exercises
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Update own exercises" on public.exercises;
create policy "Update own exercises" on public.exercises
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Delete own exercises" on public.exercises;
create policy "Delete own exercises" on public.exercises
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- workout_sets: private; can be logged on any exercise (also a friend's custom one)
drop policy if exists "Read own sets" on public.workout_sets;
create policy "Read own sets" on public.workout_sets
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Create own sets" on public.workout_sets;
create policy "Create own sets" on public.workout_sets
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Update own sets" on public.workout_sets;
create policy "Update own sets" on public.workout_sets
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Delete own sets" on public.workout_sets;
create policy "Delete own sets" on public.workout_sets
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Besonderheiten: one free-text note per exercise and day (e.g. "wide grip")
-- (added 2026-10-16, also in migrations/2026-10-16_exercise_entries.sql)
-- ---------------------------------------------------------------------------

create table if not exists public.exercise_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  date date not null,
  -- Nullable so a day entry can hold the saved workout without a note
  note text check (note is null or length(note) <= 200),
  -- Name of the saved workout it was logged from (added 2026-10-16)
  workout text check (workout is null or length(workout) <= 200),
  created_at timestamptz not null default now(),
  unique (user_id, exercise_id, date)
);

-- For databases created before the workout column existed
-- (also in migrations/2026-10-16_entries_workout.sql)
alter table public.exercise_entries
  add column if not exists workout text check (workout is null or length(workout) <= 200);

revoke all on public.exercise_entries from anon;
grant select, insert, update, delete on public.exercise_entries to authenticated;

alter table public.exercise_entries enable row level security;

drop policy if exists "Read own entries" on public.exercise_entries;
create policy "Read own entries" on public.exercise_entries
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Create own entries" on public.exercise_entries;
create policy "Create own entries" on public.exercise_entries
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Update own entries" on public.exercise_entries;
create policy "Update own entries" on public.exercise_entries
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Delete own entries" on public.exercise_entries;
create policy "Delete own entries" on public.exercise_entries
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Workouts, shared between all users
-- (added 2026-10-21, also in migrations/2026-10-21_shared_workouts.sql)
-- ---------------------------------------------------------------------------

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  -- The creator; null = built-in workout (read-only for everyone)
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  -- Empty = named after the main exercises in the app
  name text not null default '' check (length(name) <= 100),
  category text not null check (category in ('upper body', 'lower body', 'full body')),
  -- Text lines; lines starting with "- " are shown as bullet points
  warmup text not null default '' check (length(warmup) <= 2000),
  finisher text not null default '' check (length(finisher) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null
);

-- The main exercises of a workout, in order (position 1, 2, 3, ...).
-- Exercises with superset_with_next = true form a superset with the next one.
-- title, duration and cues belong to a single exercise or a whole superset;
-- for a superset they are stored on its first exercise.
create table if not exists public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  position int not null check (position >= 1),
  -- restrict: an exercise used in a workout can't be deleted
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  sets int not null check (sets between 1 and 5),
  reps_hint text not null default '' check (length(reps_hint) <= 40),
  weight_hint text not null default '' check (length(weight_hint) <= 40),
  note text not null default '' check (length(note) <= 200),
  superset_with_next boolean not null default false,
  title text not null default '' check (length(title) <= 60),
  duration text not null default '' check (length(duration) <= 20),
  cues text not null default '' check (length(cues) <= 1000),
  -- Sets are saved per exercise and day, so an exercise appears once per workout
  unique (workout_id, exercise_id)
);

create index if not exists workout_exercises_by_workout
  on public.workout_exercises (workout_id, position);

revoke all on public.workouts, public.workout_exercises from anon;
grant select, insert, update, delete on public.workouts, public.workout_exercises to authenticated;

alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;

-- workouts: everyone reads and edits; only the creator deletes; built-ins are read-only
drop policy if exists "Read all workouts" on public.workouts;
create policy "Read all workouts" on public.workouts
  for select to authenticated
  using (true);

drop policy if exists "Create own workouts" on public.workouts;
create policy "Create own workouts" on public.workouts
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Edit shared workouts" on public.workouts;
create policy "Edit shared workouts" on public.workouts
  for update to authenticated
  using (user_id is not null)
  with check (user_id is not null);

drop policy if exists "Delete own workouts" on public.workouts;
create policy "Delete own workouts" on public.workouts
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- workout_exercises: readable by everyone, changeable if the workout is editable
drop policy if exists "Read all workout exercises" on public.workout_exercises;
create policy "Read all workout exercises" on public.workout_exercises
  for select to authenticated
  using (true);

drop policy if exists "Add exercises to editable workouts" on public.workout_exercises;
create policy "Add exercises to editable workouts" on public.workout_exercises
  for insert to authenticated
  with check (exists (
    select 1 from public.workouts w where w.id = workout_id and w.user_id is not null
  ));

drop policy if exists "Change exercises of editable workouts" on public.workout_exercises;
create policy "Change exercises of editable workouts" on public.workout_exercises
  for update to authenticated
  using (exists (
    select 1 from public.workouts w where w.id = workout_id and w.user_id is not null
  ))
  with check (exists (
    select 1 from public.workouts w where w.id = workout_id and w.user_id is not null
  ));

drop policy if exists "Remove exercises from editable workouts" on public.workout_exercises;
create policy "Remove exercises from editable workouts" on public.workout_exercises
  for delete to authenticated
  using (exists (
    select 1 from public.workouts w where w.id = workout_id and w.user_id is not null
  ));

-- On every change of a workout: the creator stays the same, and "last edited by/at"
-- is filled in (used for "last edited by <name>" and to detect conflicting edits)
create or replace function public.workouts_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.user_id := old.user_id;
  new.created_at := old.created_at;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists workouts_before_update on public.workouts;
create trigger workouts_before_update before update on public.workouts
  for each row execute function public.workouts_before_update();

-- ---------------------------------------------------------------------------
-- A shared exercise can't be deleted once someone else logged it
--    (deleting it would also delete their sets). Runs with full rights so it can
--    see other users' sets; it only checks, it doesn't return any of their data.
-- ---------------------------------------------------------------------------

create or replace function public.check_exercise_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.workout_sets s
    where s.exercise_id = old.id and s.user_id is distinct from old.user_id
  ) or exists (
    select 1 from public.exercise_entries e
    where e.exercise_id = old.id and e.user_id is distinct from old.user_id
  ) then
    raise exception 'Someone else has logged this exercise, so it can''t be deleted. You can rename it instead.';
  end if;
  if exists (select 1 from public.workout_exercises we where we.exercise_id = old.id) then
    raise exception 'This exercise is used in a workout, so it can''t be deleted. Remove it from the workout first.';
  end if;
  return old;
end $$;

drop trigger if exists check_exercise_delete on public.exercises;
create trigger check_exercise_delete before delete on public.exercises
  for each row execute function public.check_exercise_delete();

-- ---------------------------------------------------------------------------
-- save_workout: saves a workout and its main exercises in one go (all or nothing);
-- refuses with 'WORKOUT_CHANGED' if someone else saved it after it was opened
-- (added 2026-10-21, also in migrations/2026-10-21_save_workout_function.sql)
-- ---------------------------------------------------------------------------

create or replace function public.save_workout(
  p_id uuid,
  p_name text,
  p_category text,
  p_warmup text,
  p_finisher text,
  p_exercises jsonb,
  p_expected_updated_at timestamptz default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_workout_id uuid := p_id;
begin
  if jsonb_typeof(p_exercises) <> 'array' or jsonb_array_length(p_exercises) = 0 then
    raise exception 'A workout needs at least one main exercise.';
  end if;

  if v_workout_id is null then
    insert into public.workouts (name, category, warmup, finisher)
    values (p_name, p_category, p_warmup, p_finisher)
    returning id into v_workout_id;
  else
    update public.workouts
    set name = p_name, category = p_category, warmup = p_warmup, finisher = p_finisher
    where id = v_workout_id
      and (p_expected_updated_at is null or updated_at = p_expected_updated_at);

    if not found then
      if not exists (select 1 from public.workouts where id = v_workout_id) then
        raise exception 'This workout doesn''t exist anymore (maybe it was deleted).';
      elsif exists (select 1 from public.workouts where id = v_workout_id and user_id is null) then
        raise exception 'Built-in workouts can''t be changed. Duplicate it instead.';
      else
        raise exception 'WORKOUT_CHANGED: someone else saved this workout after you opened it.';
      end if;
    end if;

    delete from public.workout_exercises where workout_id = v_workout_id;
  end if;

  insert into public.workout_exercises
    (workout_id, position, exercise_id, sets, reps_hint, weight_hint, note,
     superset_with_next, title, duration, cues)
  select v_workout_id, e.position, e.exercise_id, e.sets,
         coalesce(e.reps_hint, ''), coalesce(e.weight_hint, ''), coalesce(e.note, ''),
         coalesce(e.superset_with_next, false), coalesce(e.title, ''),
         coalesce(e.duration, ''), coalesce(e.cues, '')
  from jsonb_to_recordset(p_exercises) as e(
    position int, exercise_id uuid, sets int, reps_hint text, weight_hint text, note text,
    superset_with_next boolean, title text, duration text, cues text
  );

  return v_workout_id;
end $$;

-- Only signed-in users may call it (anonymous visitors can't)
revoke execute on function public.save_workout(uuid, text, text, text, text, jsonb, timestamptz)
  from public, anon;
grant execute on function public.save_workout(uuid, text, text, text, text, jsonb, timestamptz)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Profiles: a display name per user, readable by all, changeable only by its user
-- (added 2026-10-21, also in migrations/2026-10-21_profiles.sql)
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Invite-only: only email addresses on this list can create an account
-- (added 2026-10-25, also in migrations/2026-10-25_invite_only.sql;
--  how to add a person: supabase/README.md)
-- Fresh setup: the list starts empty, so put your own address on it before your
-- first login: insert into public.allowed_emails (email) values ('you@example.com');
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Built-in exercises (user_id = null)
-- ---------------------------------------------------------------------------

-- Overhead Press was renamed to Strict Press on 2026-10-16
-- (also in migrations/2026-10-16_more_built_in_exercises.sql)
update public.exercises set name = 'Strict Press'
where user_id is null and name = 'Overhead Press';

insert into public.exercises (user_id, name, category) values
  (null, 'DB Bench Press', 'Chest'),
  (null, 'BB Bench Press', 'Chest'),
  (null, 'Incline DB Press', 'Chest'),
  (null, 'Dip', 'Chest'),
  (null, 'Deadlift', 'Back'),
  (null, 'Romanian Deadlift', 'Back'),
  (null, 'Bent-Over Row', 'Back'),
  (null, 'Pull-Up', 'Back'),
  (null, 'Gorilla Row', 'Back'),
  (null, 'Chin-Up', 'Back'),
  (null, 'Back Squat', 'Legs'),
  (null, 'Front Squat', 'Legs'),
  (null, 'Lunge', 'Legs'),
  (null, 'Hip Thrust', 'Legs'),
  (null, 'Strict Press', 'Shoulders'),
  (null, 'DDB Overhead Press', 'Shoulders'),
  (null, 'Lateral Raise', 'Shoulders'),
  (null, 'Biceps Curl', 'Arms'),
  (null, 'Triceps Extension', 'Arms'),
  (null, 'Skullcrusher', 'Arms')
on conflict do nothing;
