-- Privacy and sharing test (TODO item 7d). It changes NOTHING: every write it tries
-- is undone right away.
-- Run in Supabase: SQL Editor -> New query -> paste this file -> Run.
--
-- It acts as two real accounts the way the app does (you, and your friend 1bcbf619…)
-- and checks what each of them can see and change. The result is a table: one row
-- per check with PASS or FAIL. Can be run again any time, e.g. after database changes.

-- Act like the app does for a signed-in user: role "authenticated" plus their user id
create or replace function pg_temp.become(uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end $$;

create or replace function pg_temp.privacy_test()
returns table (nr int, test text, result text, details text)
language plpgsql as $$
declare
  me uuid := 'd4eb8f70-d6b0-4220-b361-1242949b02f8';      -- you
  friend uuid := '1bcbf619-29a7-4706-9bbd-6182db3cdbff';  -- one of your friends
  -- Facts, read with full rights (not as a user)
  all_workouts int;
  all_exercises int;
  all_names int;
  my_sets int;
  my_notes int;
  friend_sets int;
  friend_notes int;
  my_workout uuid;
  exercise_in_my_workout uuid;
  my_custom_exercise uuid;
  -- Results of the individual checks
  seen int;
  seen2 int;
  changed int;
  changed2 int;
  creator uuid;
  editor uuid;
  new_set uuid;
  new_set_owner uuid;
  err_state text;
  err_text text;
begin
  select count(*) into all_workouts from public.workouts;
  select count(*) into all_exercises from public.exercises;
  select count(*) into all_names from public.profiles;
  select count(*) into my_sets from public.workout_sets where user_id = me;
  select count(*) into my_notes from public.exercise_entries where user_id = me;
  select count(*) into friend_sets from public.workout_sets where user_id = friend;
  select count(*) into friend_notes from public.exercise_entries where user_id = friend;
  select w.id into my_workout from public.workouts w
    where w.user_id = me order by w.created_at limit 1;
  select we.exercise_id into exercise_in_my_workout from public.workout_exercises we
    where we.workout_id = my_workout order by we.position limit 1;
  select e.id into my_custom_exercise from public.exercises e
    where e.user_id = me order by e.created_at limit 1;

  -- Every check runs in its own block that ends with 'undo': that rolls back anything
  -- it changed and switches back from the test user. Real errors are reported.

  -- ---------------- Shared ----------------

  nr := 1; test := 'Friend sees all workouts'; seen := null; err_text := null;
  begin
    perform pg_temp.become(friend);
    select count(*) into seen from public.workouts;
    raise exception 'undo';
  exception when others then
    if sqlerrm <> 'undo' then err_text := sqlerrm; end if;
  end;
  result := case when seen = all_workouts and all_workouts > 0 then 'PASS' else 'FAIL' end;
  details := coalesce(err_text, format('sees %s of %s workouts', seen, all_workouts));
  return next;

  nr := 2; test := 'Friend sees all exercises (also your custom ones)'; seen := null; err_text := null;
  begin
    perform pg_temp.become(friend);
    select count(*) into seen from public.exercises;
    raise exception 'undo';
  exception when others then
    if sqlerrm <> 'undo' then err_text := sqlerrm; end if;
  end;
  result := case when seen = all_exercises then 'PASS' else 'FAIL' end;
  details := coalesce(err_text, format('sees %s of %s exercises', seen, all_exercises));
  return next;

  nr := 3; test := 'Friend sees everyone''s display name'; seen := null; err_text := null;
  begin
    perform pg_temp.become(friend);
    select count(*) into seen from public.profiles;
    raise exception 'undo';
  exception when others then
    if sqlerrm <> 'undo' then err_text := sqlerrm; end if;
  end;
  result := case when seen = all_names and all_names >= 3 then 'PASS' else 'FAIL' end;
  details := coalesce(err_text, format('sees %s of %s names', seen, all_names));
  return next;

  -- ---------------- Private ----------------

  nr := 4; test := 'Friend sees none of your logged sets'; seen := null; err_text := null;
  begin
    perform pg_temp.become(friend);
    select count(*) into seen from public.workout_sets where user_id = me;
    raise exception 'undo';
  exception when others then
    if sqlerrm <> 'undo' then err_text := sqlerrm; end if;
  end;
  result := case when seen = 0 then 'PASS' else 'FAIL' end;
  details := coalesce(err_text, format('sees %s of your %s sets', seen, my_sets));
  return next;

  nr := 5; test := 'Friend sees none of your Besonderheiten/notes'; seen := null; err_text := null;
  begin
    perform pg_temp.become(friend);
    select count(*) into seen from public.exercise_entries where user_id = me;
    raise exception 'undo';
  exception when others then
    if sqlerrm <> 'undo' then err_text := sqlerrm; end if;
  end;
  result := case when seen = 0 then 'PASS' else 'FAIL' end;
  details := coalesce(err_text, format('sees %s of your %s notes', seen, my_notes));
  return next;

  nr := 6; test := 'You see none of your friend''s sets and notes'; seen := null; seen2 := null; err_text := null;
  begin
    perform pg_temp.become(me);
    select count(*) into seen from public.workout_sets where user_id = friend;
    select count(*) into seen2 from public.exercise_entries where user_id = friend;
    raise exception 'undo';
  exception when others then
    if sqlerrm <> 'undo' then err_text := sqlerrm; end if;
  end;
  result := case when seen = 0 and seen2 = 0 then 'PASS' else 'FAIL' end;
  details := coalesce(err_text, format('you see %s of %s sets and %s of %s notes',
    seen, friend_sets, seen2, friend_notes));
  return next;

  -- ---------------- Logging someone else's workout ----------------

  nr := 7; test := 'Friend logs an exercise of your workout: saved in their own data only';
  new_set_owner := null; seen := null; err_text := null;
  begin
    perform pg_temp.become(friend);
    insert into public.workout_sets (exercise_id, date, set_number, weight_kg, reps)
    values (exercise_in_my_workout, '2000-01-01', 5, 20, 5)
    returning id, user_id into new_set, new_set_owner;
    perform set_config('role', 'none', true);
    perform pg_temp.become(me);
    select count(*) into seen from public.workout_sets where id = new_set;
    raise exception 'undo';
  exception when others then
    if sqlerrm <> 'undo' then err_text := sqlerrm; end if;
  end;
  result := case when new_set_owner = friend and seen = 0 then 'PASS' else 'FAIL' end;
  details := coalesce(err_text, case when new_set_owner = friend
    then format('saved under the friend''s account; you see it: %s', case when seen = 0 then 'no' else 'yes' end)
    else 'saved under a different account' end);
  return next;

  nr := 8; test := 'Friend can''t log a set into your account'; err_state := null; err_text := null;
  begin
    perform pg_temp.become(friend);
    insert into public.workout_sets (user_id, exercise_id, date, set_number, weight_kg, reps)
    values (me, exercise_in_my_workout, '2000-01-01', 5, 20, 5);
    raise exception 'undo';
  exception when others then
    if sqlerrm <> 'undo' then err_state := sqlstate; err_text := sqlerrm; end if;
  end;
  result := case when err_state = '42501' then 'PASS' else 'FAIL' end;
  details := coalesce(err_text, 'the set was saved into your account!');
  return next;

  nr := 9; test := 'Friend can''t change or delete your sets'; changed := null; changed2 := null; err_text := null;
  begin
    perform pg_temp.become(friend);
    update public.workout_sets set reps = reps + 1 where user_id = me;
    get diagnostics changed = row_count;
    delete from public.workout_sets where user_id = me;
    get diagnostics changed2 = row_count;
    raise exception 'undo';
  exception when others then
    if sqlerrm <> 'undo' then err_text := sqlerrm; end if;
  end;
  result := case when changed = 0 and changed2 = 0 then 'PASS' else 'FAIL' end;
  details := coalesce(err_text, format('changed %s, deleted %s of your %s sets', changed, changed2, my_sets));
  return next;

  -- ---------------- Editing shared workouts ----------------

  nr := 10; test := 'Friend can edit your workout; it stays yours, "last edited by" = friend';
  creator := null; editor := null; err_text := null;
  begin
    perform pg_temp.become(friend);
    update public.workouts set name = name where id = my_workout
    returning user_id, updated_by into creator, editor;
    raise exception 'undo';
  exception when others then
    if sqlerrm <> 'undo' then err_text := sqlerrm; end if;
  end;
  result := case when creator = me and editor = friend then 'PASS' else 'FAIL' end;
  details := coalesce(err_text, case when creator is null then 'the edit was not allowed'
    else format('creator stays you: %s, last edited by friend: %s',
      case when creator = me then 'yes' else 'no' end,
      case when editor = friend then 'yes' else 'no' end) end);
  return next;

  nr := 11; test := 'Friend can''t delete your workout'; changed := null; err_text := null;
  begin
    perform pg_temp.become(friend);
    delete from public.workouts where id = my_workout;
    get diagnostics changed = row_count;
    raise exception 'undo';
  exception when others then
    if sqlerrm <> 'undo' then err_text := sqlerrm; end if;
  end;
  result := case when changed = 0 then 'PASS' else 'FAIL' end;
  details := coalesce(err_text, format('deleted %s workouts', changed));
  return next;

  nr := 12; test := 'Friend can''t change your display name'; changed := null; err_text := null;
  begin
    perform pg_temp.become(friend);
    update public.profiles set display_name = 'hacked' where id = me;
    get diagnostics changed = row_count;
    raise exception 'undo';
  exception when others then
    if sqlerrm <> 'undo' then err_text := sqlerrm; end if;
  end;
  result := case when changed = 0 then 'PASS' else 'FAIL' end;
  details := coalesce(err_text, format('changed %s names', changed));
  return next;

  nr := 13; test := 'Friend can''t rename or delete your custom exercise';
  changed := null; changed2 := null; err_text := null;
  begin
    perform pg_temp.become(friend);
    update public.exercises set name = name || ' x' where id = my_custom_exercise;
    get diagnostics changed = row_count;
    delete from public.exercises where id = my_custom_exercise;
    get diagnostics changed2 = row_count;
    raise exception 'undo';
  exception when others then
    if sqlerrm <> 'undo' then err_text := sqlerrm; end if;
  end;
  result := case when my_custom_exercise is null then 'NOT TESTED'
    when changed = 0 and changed2 = 0 then 'PASS' else 'FAIL' end;
  details := coalesce(err_text, case when my_custom_exercise is null
    then 'you have no custom exercise to test with'
    else format('renamed %s, deleted %s', changed, changed2) end);
  return next;

  -- ---------------- Outsiders ----------------

  nr := 14; test := 'Visitors who are not logged in see nothing'; err_state := null; err_text := null;
  begin
    perform set_config('role', 'anon', true);
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    perform count(*) from public.workouts;
    raise exception 'undo';
  exception when others then
    if sqlerrm <> 'undo' then err_state := sqlstate; err_text := sqlerrm; end if;
  end;
  result := case when err_state = '42501' then 'PASS' else 'FAIL' end;
  details := coalesce(err_text, 'workouts were readable without logging in!');
  return next;

  nr := 15; test := 'Invite-only lock is installed'; seen := null; seen2 := null;
  select count(*) into seen from pg_trigger
    where tgname = 'check_allowed_email' and tgrelid = 'auth.users'::regclass;
  select count(*) into seen2 from public.allowed_emails;
  result := case when seen = 1 and seen2 >= 3 then 'PASS' else 'FAIL' end;
  details := format('lock: %s, addresses on the list: %s', case when seen = 1 then 'on' else 'missing' end, seen2);
  return next;

  nr := 16; test := 'A stranger''s email can''t create an account'; err_state := null; err_text := null;
  begin
    insert into auth.users (id, email, aud, role)
    values (gen_random_uuid(), 'stranger.test@example.com', 'authenticated', 'authenticated');
    raise exception 'undo';
  exception when others then
    if sqlerrm <> 'undo' then err_state := sqlstate; err_text := sqlerrm; end if;
  end;
  result := case
    when err_text like '%invite-only%' then 'PASS'
    when err_state = '42501' then 'NOT TESTED'
    else 'FAIL' end;
  details := case
    when err_text like '%invite-only%' then 'refused: ' || err_text
    when err_state = '42501' then 'the SQL editor may not create accounts directly; test 15 shows the lock is on'
    else coalesce(err_text, 'the account was created (then undone)!') end;
  return next;
end $$;

select * from pg_temp.privacy_test();
