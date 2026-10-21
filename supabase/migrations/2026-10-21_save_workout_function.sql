-- Migration (TODO item 7b): save a workout and its main exercises in one go.
-- Run once in Supabase: SQL Editor -> New query -> paste this file -> Run.
-- Safe to run again. supabase/schema.sql contains the same for new setups.
--
-- save_workout(...) is called by the workout builder. It saves everything or nothing,
-- so a lost connection can't leave a workout half saved. It runs with the rights of
-- the person saving (security invoker), so all the sharing rules (RLS) still apply.
--
--   p_id                  null = new workout (you are its creator), otherwise the workout to change
--   p_exercises           list of main exercises: [{ "position": 1, "exercise_id": "…", "sets": 4,
--                         "reps_hint": "8-10", "weight_hint": "", "note": "", "superset_with_next": false,
--                         "title": "", "duration": "", "cues": "" }, …]
--   p_expected_updated_at when the workout was last changed at the time you opened it. If someone
--                         saved it in the meantime, nothing is saved and the error starts with
--                         'WORKOUT_CHANGED' (the app then warns instead of overwriting their version)
--
-- Returns the workout's id.

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
