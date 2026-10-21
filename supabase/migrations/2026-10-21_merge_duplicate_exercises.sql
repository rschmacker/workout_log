-- One-time cleanup, run BEFORE 2026-10-21_shared_workouts.sql.
-- Until now every user got their own copy of the exercises from the workout files
-- (Inverted Row, Push-Up, ...). From now on exercises are shared, so each name may
-- exist only once. For every duplicated name this keeps the oldest copy, moves any
-- sets and notes logged on the other copies to it, and deletes the other copies.
-- If a set or note can't be moved (the same user logged the same day on two copies),
-- it stops with a message and changes nothing.
-- Run once in Supabase: SQL Editor -> New query -> paste this file -> Run.

do $$
declare
  dup record;
  keep uuid;
begin
  for dup in
    select e.id, e.name, lower(e.name) as key
    from public.exercises e
    where lower(e.name) in (
      select lower(name) from public.exercises group by lower(name) having count(*) > 1
    )
    order by lower(e.name), e.created_at
  loop
    -- The copy to keep: a built-in one if there is one, otherwise the oldest
    select id into keep from public.exercises
    where lower(name) = dup.key
    order by (user_id is null) desc, created_at
    limit 1;
    if dup.id = keep then
      continue;
    end if;

    update public.workout_sets s set exercise_id = keep
    where s.exercise_id = dup.id
      and not exists (
        select 1 from public.workout_sets k
        where k.exercise_id = keep and k.user_id = s.user_id
          and k.date = s.date and k.set_number = s.set_number
      );
    update public.exercise_entries n set exercise_id = keep
    where n.exercise_id = dup.id
      and not exists (
        select 1 from public.exercise_entries k
        where k.exercise_id = keep and k.user_id = n.user_id and k.date = n.date
      );

    if exists (select 1 from public.workout_sets where exercise_id = dup.id)
       or exists (select 1 from public.exercise_entries where exercise_id = dup.id) then
      raise exception 'Could not merge "%": the same day is logged on two copies. Nothing was changed.', dup.name;
    end if;

    delete from public.exercises where id = dup.id;
    raise notice 'Removed a duplicate of "%"', dup.name;
  end loop;
end $$;
