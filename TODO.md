# TODO: Improvements

Work through these one at a time, in this order. After each item: stop, tell me how to test it, and list any manual Supabase/GitHub steps.

## 1. Prefill weight from previous set
- [x] When I enter weight in set 1, prefill the weight field of set 2 with the same value (reps stay empty)
- [x] Same chain for sets 3 to 5: each set prefills from the set before it
- [x] Prefill only if the field is still empty; never overwrite what I typed
- [x] Prefilled value should be selected/editable with one tap
- Done: the prefill appears when tapping into a row (weight, reps or −/+), shown in gray until reps are entered; gray rows without reps are skipped on save

## 2. "Besonderheiten" (free text note per exercise entry)
- [x] Add a text field below the sets of each exercise/day entry (label: "Besonderheiten", e.g. "wide grip", "3s down")
- [x] Schema: new table `exercise_entries` (id, user_id, exercise_id, date, note), unique on (user_id, exercise_id, date); RLS like the other tables; provide SQL in `supabase/schema.sql` plus a migration snippet
- [x] Autocomplete: after the first typed letter, suggest my previously entered notes (case-insensitive, matching anywhere in the text); show notes used for this exercise first, then notes from other exercises
- [x] Tapping a suggestion fills the field; free text still allowed
- [x] Show the note in the history view
- Done: migration in `supabase/migrations/2026-10-16_exercise_entries.sql` (run 2026-10-16); the note also shows in the "Last time" line

## 3. CSV export
- [x] Button (e.g. in a settings/menu screen) that exports all sets as CSV
- [x] Columns: date, exercise, category, set_number, weight_kg, reps, note, workout (if logged from a saved workout)
- [x] Format for German Excel only: UTF-8 with BOM, semicolon delimiter, decimal comma, dates as DD.MM.YYYY. No format options needed
- [ ] Download works in iPhone Safari / Home Screen app (test it) — built with the iOS share sheet ("Save to Files"); still to be tested on the iPhone
- Done: Settings screen (top right on Home) with "Export CSV"; the workout column stays empty until item 4

## 4. Saved workouts
### 4a. Data and structure
- [x] Workouts are defined in files in the repo (`workouts/*.json`), not in the app UI; they are bundled at build time. Document the file format in `workouts/README.md` with one example
- [x] Fields: `name`, `category` (upper body | lower body | full body), `warmup` (list of strings), `main` (list of exercises), `finisher` (list of strings)
- [x] Each main exercise: `exercise` (must match a base exercise in the library or be created), optional `note` (Besonderheit, e.g. "wide grip"), `sets` (number prescribed), optional `reps`/`weight` hint as text
- [x] Validate files at build time and fail with a clear error message if something is wrong
- [x] Workout names are derived from the main exercises (e.g. "BB Bench Press + Weighted Pull-Up") unless a `name` is given

### 4b. Screens
- [x] Saved workouts live in the "Workouts" section of the Home screen (see item 6) with three entries: Upper body, Lower body, Full body
- [x] Tapping a category lists its workouts (named by main exercises)
- [x] Workout screen: Warmup (checklist, no logging), Main exercises (tappable cards), Finisher (checklist, no logging) — decided: warmup and finisher are plain lists without checkboxes
- [x] Tapping a main exercise opens the existing date + set entry screen for this exercise, with the date defaulting to today, only the prescribed number of sets shown, and the workout's note prefilled as Besonderheit
- [x] Back button returns to the workout screen I came from (not the Home screen)
- [x] Mark main exercises as done once sets are logged for the selected date

### 4c. Home screen integration
- [x] When a workout contains a main exercise, make sure it appears on the Home screen
- [x] If it is a variation of an existing exercise (e.g. "wide grip DB Bench Press"), do NOT create a new card, chip or exercise: use the base exercise ("DB Bench Press") and save "wide grip" only as the Besonderheit, so it shows in the history next to weight and reps. The Home screen must stay uncluttered
- [x] If the movement is genuinely different and the base exercise does not exist yet, create it as a new exercise card
- [x] Rule for "sufficiently different": different movement = new exercise; same movement with different grip/tempo/stance = base exercise + Besonderheit
- Done (2026-10-16), with these additions and decisions:
  - Supersets: a main item can be `{ "superset": [...] }`; any main item can have `title`, `time`, `cues`. Superset exercises keep separate screens with a "Save & go to …" button
  - Bodyweight: an empty weight is saved as 0 kg and shown as "BW"
  - "Done" means sets logged today; the workout a day was logged from is saved in `exercise_entries.workout` (CSV column)
  - The build checks variations automatically against the built-in names (`src/builtInExercises.ts`); new exercises need a `category` and are created per user
  - Built-in exercises: Overhead Press renamed to Strict Press; added DDB Overhead Press, Gorilla Row, Chin-Up, Dip, Skullcrusher
  - Workouts: 4 files in `workouts/` (2 full body, 1 upper, 1 lower body)

## 5. Body illustrations and visual polish (phone first)
- [x] Show a body figure on each body-part button in the "Exercises" section of the Home screen (see item 6): Chest, Back/Hinge, Legs, Shoulders, Arms, Core, with the muscles of that broad category highlighted. Categories only, not individual exercises
- [x] Use the open-source npm package `react-body-highlighter` (detailed anatomical SVG, front and back views, named muscles; the app is non-commercial). First check its license on GitHub and tell me what it says. Wrap it in one small reusable component (`BodyMap`) that takes a category and highlights the right muscles — MIT license
- [x] Muscle mapping (check the exact names the package supports, and tell me if one is missing) — all exist except "adductors": the package calls the front inner thigh "abductors", used for Legs:
  - Chest: chest (front view)
  - Back/Hinge: upper-back, trapezius, lower-back, gluteal, hamstring (back view)
  - Legs: quadriceps, calves, adductors (front view)
  - Shoulders: front-deltoids, back-deltoids
  - Arms: biceps, triceps, forearm
  - Core: abs, obliques (front view)
- [x] Use the app's accent color for highlighted muscles and a muted gray for the rest, in light and dark mode. ~~Show front and back view side by side where a category needs both (shoulders, arms)~~ — decided: front view only for shoulders and arms
- [x] Size about 80 to 100 px tall, crisp on retina screens, with an accessible label (e.g. "Chest muscles highlighted"). Make sure it does not slow down the Home screen
- [x] Overall look on iPhone: rounded cards with soft shadows, generous spacing, large readable type, tap targets of at least 44 px, light and dark mode, subtle press animations, safe-area padding at the top and bottom, no horizontal scrolling — light mode follows the iPhone setting; status bar switched to "default" with theme colors
- [x] Applies to the saved workouts section too, so the whole Home screen feels consistent
- [x] After building it, tell me how to check it on my phone, and I will send screenshots for adjustments — checked on the iPhone, no changes needed

## 6. Restructured Home screen (Exercises and Workouts)
Suggested order: do this right after item 3 and before items 4 and 5, since both build on it.
- [x] The Home screen has two clearly separated sections with headings: "Exercises" and "Workouts"
- [x] **Exercises section:** a grid (2 columns on phone) of large buttons, one per body part: Chest, Back/Hinge, Legs, Shoulders, Arms, Core. Each button shows the body image with the highlighted muscles (item 5) and the name. Until item 5 is built, use a plain placeholder icon
- [x] Tapping a body part opens a list of the exercises for that body part (e.g. Chest: DB Bench Press, BB Bench Press, Incline DB Press). Tapping an exercise opens the existing date + set entry screen. Include "Add custom exercise" at the bottom of this list
- [x] **Workouts section:** three large buttons: Upper body, Lower body, Full body
- [x] Tapping one lists the saved workouts of that type, named by their main exercises. Tapping a workout opens the workout screen (item 4)
- [x] Navigation: each screen has a clear back button that goes exactly one level up (entry screen to exercise list to Home, or workout screen to workout list to Home); never jump straight to the Home screen unexpectedly — Back returns to the previous screen; if a screen was opened directly, it goes to its parent
- [x] Keep it fast: Home should show everything without scrolling much on an iPhone, with both sections visible or at most one short scroll
- [x] Show the last logged date on each exercise in the lists (small gray text), so I see what I trained recently

## 7. Workout builder (create workouts inside the app)
This replaces the repo JSON files from item 4a as the way to create new workouts. ~~Existing JSON workouts stay as read-only built-in examples.~~ Decided: the 4 existing workouts were imported as my own workouts (editable by everyone, deletable by me); the JSON files are removed.

Done in steps: **7a** database + import (done 2026-10-21), **7b** builder screen (done 2026-10-21), **7c** people (names, "by", filter, last edited, conflicts; done 2026-10-25), **7d** friends (allowlist, login, privacy test).

- [x] Data: store workouts in Supabase instead of repo files. Tables: `workouts` (id, user_id null for built-ins, name, category upper|lower|full, warmup text, finisher text, created_at) and `workout_exercises` (id, workout_id, position, exercise_id, sets 1 to 5, reps_hint text, note text for Besonderheit, is_superset bool, superset_note text). RLS: all signed-in users can read and edit all workouts and read the custom exercises they use; only the creator can delete their own workout; built-ins (user_id null) are read-only for everyone. Logged sets, Besonderheiten and history stay private to each user. Provide the SQL and a one-time import of the existing JSON workouts as built-ins — decided: supersets as groups (`superset_with_next`) with `title`, `duration`, `cues` instead of is_superset/superset_note; plus `weight_hint`, `updated_at`, `updated_by`; all exercises are shared and names are unique; an exercise can't be deleted once someone else logged it or a workout uses it
- [x] Entry point: in the workout list of each type (Upper body, Lower body, Full body) add a "+ Create workout" button at the top; the new workout is saved under that type
- [x] Builder screen, top to bottom:
  - Name (optional; if empty, name it automatically after the main exercises)
  - **Warmup:** free text list, one item per line, add/remove items
  - **Main exercises:** "+ Add exercise" opens the same exercise menu as the Home screen (body-part buttons, then exercise list), including "Add custom exercise". After choosing, return to the builder. Reorder (up/down) and remove exercises
  - Per main exercise: number of sets (1 to 5), optional reps/weight hint as text, optional Besonderheit (with the same autocomplete as in the entry screen), and a "Superset" switch. If Superset is on, show a free text field for the description (e.g. "with strict pull-ups, no rest") — decided: "Superset with next exercise" switch that groups exercises, plus optional title and cues per exercise/superset
  - **Finisher:** free text list like the warmup
  - Save and Cancel; warn before leaving with unsaved changes
- [x] Everyone can edit any workout; only the creator can delete their own workout (long press or a menu on the workout in the list). Everyone can also duplicate any workout ("Duplicate" creates my own copy, so I can change things without touching the original). Built-in examples are read-only and can only be duplicated — done as a ⋯ menu on each workout in the list (Edit, Duplicate, Delete for the creator), plus Edit on the workout screen
- [x] Because several people can edit: show "last edited by <name>, <date>" on each workout, and if someone else saved changes while I had it open, warn me before overwriting instead of silently replacing their version — conflict warning done in 7b ("Load their version" / "Save mine anyway"); "last edited by <name>, <date>" on the workout screen (7c)
- [x] Show the superset description as a small label on the exercise in the workout screen — supersets are shown as a group with a "Superset · N rounds" label, title and cues (decided in item 4)
- [x] The workout screen and logging stay as in item 4: tapping a main exercise opens the entry screen with only the prescribed number of sets
- [x] Validation: at least one main exercise; maximum 5 sets; clear error messages
- [ ] Users: me and 2 friends (3 in total), invite-only. Keep public sign-ups disabled; tell me step by step how to add my friends in Supabase (invite by email) and which login method works best for them (email magic link, or GitHub if they have an account). Make sure strangers cannot register — both friends already have accounts (GitHub); sign-ups are off again; invite-only lock (allowed_emails + database rule) added 2026-10-25, how to add a person in supabase/README.md. Open: a 4th account appeared (allowlist has 4 addresses) - to be identified
- [x] Sharing: workouts and custom exercises are visible to all three users. Logged sets, Besonderheiten and history are private per user (verify with RLS policies) — verified 2026-10-25 with supabase/tests/privacy_and_sharing_test.sql (all 16 checks PASS)
- [x] Add a small `profiles` table with a display name per user (editable in a settings screen). Show "by <name>" on each workout in the lists, and add a filter "All / Mine" — done; own workouts show "by you"; the filter choice is remembered on the phone
- [x] Doing someone else's workout logs the sets to my own data only — verified (test 7)
- [x] Test with a second account that sharing and privacy work as described, and tell me the result — done as an SQL test acting as me and a friend, every change undone; all 16 checks PASS (2026-10-25)

## Decisions
- Variations (e.g. wide grip) are only saved as Besonderheit in the history, no extra chips or cards on the Home screen
- Maximum 5 sets everywhere, also in saved workouts
- Prescribed reps/weight are shown as a text hint above the set fields
- CSV is for German Excel only
- Besonderheiten are per exercise and day, not per set
- New workouts are created in the app (item 7), stored in Supabase; ~~repo JSON files are only built-in examples~~ the JSON files were imported and removed
- Workouts: everyone can edit, only the creator can delete
- Supersets are groups ("superset with next exercise") with optional title, time and cues
