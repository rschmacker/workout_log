-- Migration: Overhead Press becomes Strict Press; new built-in exercises
-- DDB Overhead Press, Gorilla Row, Chin-Up, Dip and Skullcrusher.
-- Run once in Supabase: SQL Editor -> New query -> paste this file -> Run.
-- Safe to run again. supabase/schema.sql already contains the same for new setups.

-- Rename instead of delete: everything logged under Overhead Press is kept (now Strict Press)
update public.exercises set name = 'Strict Press'
where user_id is null and name = 'Overhead Press';

insert into public.exercises (user_id, name, category) values
  (null, 'DDB Overhead Press', 'Shoulders'),
  (null, 'Gorilla Row', 'Back'),
  (null, 'Chin-Up', 'Back'),
  (null, 'Dip', 'Chest'),
  (null, 'Skullcrusher', 'Arms')
on conflict do nothing;
