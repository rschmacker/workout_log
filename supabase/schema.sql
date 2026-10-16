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
-- Row Level Security: every user only sees and changes their own rows
-- ((select auth.uid()) is the id of the logged-in user)
-- ---------------------------------------------------------------------------

alter table public.exercises enable row level security;
alter table public.workout_sets enable row level security;

-- exercises
drop policy if exists "Read built-in and own exercises" on public.exercises;
create policy "Read built-in and own exercises" on public.exercises
  for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));

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

-- workout_sets (sets may only point to a built-in exercise or one of your own)
drop policy if exists "Read own sets" on public.workout_sets;
create policy "Read own sets" on public.workout_sets
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Create own sets" on public.workout_sets;
create policy "Create own sets" on public.workout_sets
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.exercises e
      where e.id = exercise_id
        and (e.user_id is null or e.user_id = (select auth.uid()))
    )
  );

drop policy if exists "Update own sets" on public.workout_sets;
create policy "Update own sets" on public.workout_sets
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.exercises e
      where e.id = exercise_id
        and (e.user_id is null or e.user_id = (select auth.uid()))
    )
  );

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
  -- Nullable so a day entry can later hold other info (e.g. the saved workout) without a note
  note text check (note is null or length(note) <= 200),
  created_at timestamptz not null default now(),
  unique (user_id, exercise_id, date)
);

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
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.exercises e
      where e.id = exercise_id
        and (e.user_id is null or e.user_id = (select auth.uid()))
    )
  );

drop policy if exists "Update own entries" on public.exercise_entries;
create policy "Update own entries" on public.exercise_entries
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.exercises e
      where e.id = exercise_id
        and (e.user_id is null or e.user_id = (select auth.uid()))
    )
  );

drop policy if exists "Delete own entries" on public.exercise_entries;
create policy "Delete own entries" on public.exercise_entries
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Built-in exercises (user_id = null)
-- ---------------------------------------------------------------------------

insert into public.exercises (user_id, name, category) values
  (null, 'DB Bench Press', 'Chest'),
  (null, 'BB Bench Press', 'Chest'),
  (null, 'Incline DB Press', 'Chest'),
  (null, 'Deadlift', 'Back'),
  (null, 'Romanian Deadlift', 'Back'),
  (null, 'Bent-Over Row', 'Back'),
  (null, 'Pull-Up', 'Back'),
  (null, 'Back Squat', 'Legs'),
  (null, 'Front Squat', 'Legs'),
  (null, 'Lunge', 'Legs'),
  (null, 'Hip Thrust', 'Legs'),
  (null, 'Overhead Press', 'Shoulders'),
  (null, 'Lateral Raise', 'Shoulders'),
  (null, 'Biceps Curl', 'Arms'),
  (null, 'Triceps Extension', 'Arms')
on conflict do nothing;
