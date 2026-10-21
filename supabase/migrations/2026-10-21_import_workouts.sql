-- One-time import (TODO item 7a): the 4 workouts from the former workouts/*.json files,
-- as your own workouts (everyone can use and edit them, only you can delete them).
-- Run once in Supabase AFTER 2026-10-21_shared_workouts.sql: SQL Editor -> New query -> paste -> Run.
-- Safe to run again: workouts that already exist are skipped (see the messages below the editor).
-- Generated from the JSON files. The workouts are assigned to your account
-- (r.schmacker@posteo.de, id d4eb8f70-…), not to your friends' accounts.

do $$
declare
  me uuid := 'd4eb8f70-d6b0-4220-b361-1242949b02f8';
  new_workout uuid;
begin
  if not exists (select 1 from auth.users where id = me) then
    raise exception 'Your user account % was not found. Import stopped.', me;
  end if;

  -- Custom exercises used in the workouts (only created if they don't exist yet)
  insert into public.exercises (user_id, name, category)
  select me, 'Push-Up', 'Chest'
  where not exists (select 1 from public.exercises where lower(name) = lower('Push-Up'));
  insert into public.exercises (user_id, name, category)
  select me, 'Plank Pull-Through', 'Core'
  where not exists (select 1 from public.exercises where lower(name) = lower('Plank Pull-Through'));
  insert into public.exercises (user_id, name, category)
  select me, 'Inverted Row', 'Back'
  where not exists (select 1 from public.exercises where lower(name) = lower('Inverted Row'));
  insert into public.exercises (user_id, name, category)
  select me, 'Hanging Leg Crunch', 'Core'
  where not exists (select 1 from public.exercises where lower(name) = lower('Hanging Leg Crunch'));

  -- Lunge + Chin-Up + Overhead Press (full body), from workouts/full-body-lunge-pull-up-press.json
  if exists (select 1 from public.workouts where user_id = me and name = 'Lunge + Chin-Up + Overhead Press') then
    raise notice 'Already imported, skipped: %', 'Lunge + Chin-Up + Overhead Press';
  else
    insert into public.workouts (user_id, name, category, warmup, finisher, updated_by)
    values (me, 'Lunge + Chin-Up + Overhead Press', 'full body', '3 Rounds:
- 20 Alternating Reverse Lunges (increase DDB weight in rounds 2 + 3)
- 10/10 Single Leg Glute Bridges
- 10 Supinated Ring Rows', '', me)
    returning id into new_workout;
    insert into public.workout_exercises
      (workout_id, position, exercise_id, sets, reps_hint, weight_hint, note, superset_with_next, title, duration, cues)
    values
      (new_workout, 1, (select id from public.exercises where lower(name) = lower('Lunge')), 4, '9 + 9 m', '', 'DDB suitcase walking lunges', true, '', '', '2 sec eccentric
~2 min rest'),
      (new_workout, 2, (select id from public.exercises where lower(name) = lower('Chin-Up')), 4, '8-10', '', 'narrow grip', false, '', '', ''),
      (new_workout, 3, (select id from public.exercises where lower(name) = lower('DDB Overhead Press')), 3, '8-10', '', 'seated', true, '', '', '2 sec eccentric
~2 min rest'),
      (new_workout, 4, (select id from public.exercises where lower(name) = lower('Biceps Curl')), 3, 'max', '', 'banded, single DB', false, '', '', ''),
      (new_workout, 5, (select id from public.exercises where lower(name) = lower('Push-Up')), 3, '15', '', 'close grip, on dumbbells', true, '', '', '2-3 rounds
Push-ups directly into pull-throughs
90 sec rest'),
      (new_workout, 6, (select id from public.exercises where lower(name) = lower('Plank Pull-Through')), 3, '20', '', 'alternating, high plank, dumbbell', false, '', '', '');
    raise notice 'Imported: %', 'Lunge + Chin-Up + Overhead Press';
  end if;

  -- Deadlift + Bench Press + Row (full body), from workouts/full-body-tb.json
  if exists (select 1 from public.workouts where user_id = me and name = 'Deadlift + Bench Press + Row') then
    raise notice 'Already imported, skipped: %', 'Deadlift + Bench Press + Row';
  else
    insert into public.workouts (user_id, name, category, warmup, finisher, updated_by)
    values (me, 'Deadlift + Bench Press + Row', 'full body', 'Coaches Choice, oder 3 Rounds:
- 10 Slow DKB/DDB Deadlifts
- 10 Slow Ring Rows
- 10 Slow Push Ups
In 3 Warm Up Sets hocharbeiten zum Deadlift Startgewicht:
- 10 reps @ leichteres Gewicht
- 6 reps @ moderates Gewicht
- 4 reps @ knapp unter Startgewicht
Dann ab in den Pump!', '', me)
    returning id into new_workout;
    insert into public.workout_exercises
      (workout_id, position, exercise_id, sets, reps_hint, weight_hint, note, superset_with_next, title, duration, cues)
    values
      (new_workout, 1, (select id from public.exercises where lower(name) = lower('Deadlift')), 5, '6-8', '', '', false, 'Glute & Hamstring Pump', '15 min', 'RIR 1-2
2 sec eccentric
>2 min rest'),
      (new_workout, 2, (select id from public.exercises where lower(name) = lower('DB Bench Press')), 4, '8-10', '', '', true, 'Chest & Lat Pump', '18 min', 'RIR 1-2
3 sec eccentric
>2 min rest
Sets 1-4: DB Bench Press + Inverted Rows
Set 5: max Push-Ups + max Inverted Rows'),
      (new_workout, 3, (select id from public.exercises where lower(name) = lower('Inverted Row')), 5, '12-15', '', '', true, '', '', ''),
      (new_workout, 4, (select id from public.exercises where lower(name) = lower('Push-Up')), 1, 'max', '', '', false, '', '', '');
    raise notice 'Imported: %', 'Deadlift + Bench Press + Row';
  end if;

  -- Romanian Deadlift + Leg Crunch (lower body), from workouts/lower-body-rdl-goblet-squat.json
  if exists (select 1 from public.workouts where user_id = me and name = 'Romanian Deadlift + Leg Crunch') then
    raise notice 'Already imported, skipped: %', 'Romanian Deadlift + Leg Crunch';
  else
    insert into public.workouts (user_id, name, category, warmup, finisher, updated_by)
    values (me, 'Romanian Deadlift + Leg Crunch', 'lower body', '3 Rounds:
- 10 Slow Weighted Plate Good Mornings
- 16 Alternating Single Leg V-Ups
- 30 sec Glute Bridge Hold
In 3 Warm Up Sets hocharbeiten zum Romanian Deadlift Startgewicht:
- 10 reps @ leichteres Gewicht
- 6 reps @ moderates Gewicht
- 4 reps @ knapp unter Startgewicht
Dann ab in den Pump!', 'Glute & Quad Pump: 4-5 Rounds, 40 sec Work / 20 sec Rest
- Heels Elevated Goblet Squats (KB or DB), 2 sec eccentric
- Weighted Front Plank Hold
- Reverse Plank Hold', me)
    returning id into new_workout;
    insert into public.workout_exercises
      (workout_id, position, exercise_id, sets, reps_hint, weight_hint, note, superset_with_next, title, duration, cues)
    values
      (new_workout, 1, (select id from public.exercises where lower(name) = lower('Romanian Deadlift')), 5, '8-10', 'RIR 1-2', 'barbell', true, 'Glute & Hamstring Pump', '', 'Romanian Deadlift: 3 sec eccentric
>2 min rest'),
      (new_workout, 2, (select id from public.exercises where lower(name) = lower('Hanging Leg Crunch')), 5, 'max', '', 'slow', false, '', '', '');
    raise notice 'Imported: %', 'Romanian Deadlift + Leg Crunch';
  end if;

  -- Strict Press + Pull-Up + Bench Press + Row (upper body), from workouts/upper-body-press-pull-up-bench-row.json
  if exists (select 1 from public.workouts where user_id = me and name = 'Strict Press + Pull-Up + Bench Press + Row') then
    raise notice 'Already imported, skipped: %', 'Strict Press + Pull-Up + Bench Press + Row';
  else
    insert into public.workouts (user_id, name, category, warmup, finisher, updated_by)
    values (me, 'Strict Press + Pull-Up + Bench Press + Row', 'upper body', '2 Rounds:
- 10 Mini Band Overhead Press
- 10 Pronated Ring Rows
- 10 Scapula Push Ups
OH Press + Pull Up Prep (ca. 30 sec Rest zwischen jedem Set):
- 8 reps Empty Bar + 8 Scap. Pull Ups
- 6 reps Moderat + 6 Scap. Pull Ups
- 3 reps Close Working Weight + 3 Scap. Pull Ups', '', me)
    returning id into new_workout;
    insert into public.workout_exercises
      (workout_id, position, exercise_id, sets, reps_hint, weight_hint, note, superset_with_next, title, duration, cues)
    values
      (new_workout, 1, (select id from public.exercises where lower(name) = lower('Strict Press')), 4, '8-10', '', 'seated', true, '', '', 'Scale: 8-10 mixed / negative or leg-assisted pull-ups
2 sec eccentric both movements
~2 min rest'),
      (new_workout, 2, (select id from public.exercises where lower(name) = lower('Pull-Up')), 4, '8-10', '', 'pronated, weighted', false, '', '', ''),
      (new_workout, 3, (select id from public.exercises where lower(name) = lower('DB Bench Press')), 3, '10-12', '', '', true, '', '', '2 sec eccentric both movements
~2 min rest'),
      (new_workout, 4, (select id from public.exercises where lower(name) = lower('Bent-Over Row')), 3, '10-12', '', 'barbell', false, '', '', ''),
      (new_workout, 5, (select id from public.exercises where lower(name) = lower('Biceps Curl')), 3, '', '', 'single DB', false, 'Finisher (optional)', '', '');
    raise notice 'Imported: %', 'Strict Press + Pull-Up + Bench Press + Row';
  end if;
end $$;
