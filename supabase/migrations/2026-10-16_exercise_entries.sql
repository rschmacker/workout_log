-- Migration: add "Besonderheiten" (one free-text note per exercise and day)
-- Run once in Supabase: SQL Editor -> New query -> paste this file -> Run.
-- Safe to run again. supabase/schema.sql already contains the same SQL for new setups.

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
