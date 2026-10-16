-- Migration: remember which saved workout an exercise was logged from (for the CSV export)
-- Run once in Supabase: SQL Editor -> New query -> paste this file -> Run.
-- Safe to run again. supabase/schema.sql already contains the same column for new setups.

alter table public.exercise_entries
  add column if not exists workout text check (workout is null or length(workout) <= 200);
