-- Migration (TODO item 7a): workouts stored in Supabase and shared between all users.
-- Run once in Supabase: SQL Editor -> New query -> paste this file -> Run.
-- Run 2026-10-21_merge_duplicate_exercises.sql first (exercise names must be unique).
-- Safe to run again. supabase/schema.sql contains the same for new setups.
--
-- What is shared and what is private:
--   shared:  workouts, and all exercises (built-in and custom) - readable by every
--            signed-in user; every user can edit workouts, only the creator can delete
--   private: logged sets and Besonderheiten/notes (workout_sets, exercise_entries)

-- ---------------------------------------------------------------------------
-- 1. Exercises are shared: every signed-in user sees all exercises
-- ---------------------------------------------------------------------------

drop policy if exists "Read built-in and own exercises" on public.exercises;
drop policy if exists "Read all exercises" on public.exercises;
create policy "Read all exercises" on public.exercises
  for select to authenticated
  using (true);

-- One shared list: no two exercises with the same name (ignoring upper/lower case)
create unique index if not exists exercises_name_unique on public.exercises (lower(name));

-- ---------------------------------------------------------------------------
-- 2. Sets and notes stay private, but can be logged on any exercise
--    (also on a custom exercise a friend created)
-- ---------------------------------------------------------------------------

drop policy if exists "Create own sets" on public.workout_sets;
create policy "Create own sets" on public.workout_sets
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Update own sets" on public.workout_sets;
create policy "Update own sets" on public.workout_sets
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Create own entries" on public.exercise_entries;
create policy "Create own entries" on public.exercise_entries
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Update own entries" on public.exercise_entries;
create policy "Update own entries" on public.exercise_entries
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. Workouts
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
-- 4. A shared exercise can't be deleted once someone else logged it
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
