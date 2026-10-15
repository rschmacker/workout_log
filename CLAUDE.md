# Workout Log (CrossFit / Tone & Build)

Personal web app (PWA) to log strength sets per exercise and date. Used mainly on an iPhone in Safari, added to the Home Screen. Single user.

## Stack
- Vite + React + TypeScript
- Supabase (Postgres + Auth) for online storage; login via "Sign in with GitHub" (email magic link as fallback)
- Hosting: GitHub Pages, deployed with a GitHub Actions workflow
- Use HashRouter (not BrowserRouter) so GitHub Pages does not 404 on reload
- Set Vite `base` to `/<repo-name>/`
- PWA: web manifest, icons, `display: standalone`, viewport meta for iPhone (safe-area insets)
- Supabase URL and anon key come from env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`); store them as GitHub Actions secrets, never hardcode service-role keys

## Screens
1. **Home**: grid/list of common exercises as large tappable cards, grouped by category (Chest, Back, Legs, Shoulders, Arms, Core). Default exercises:
   - Chest: DB Bench Press, BB Bench Press, Incline DB Press
   - Back/Hinge: Deadlift, Romanian Deadlift, Bent-Over Row, Pull-Up
   - Legs: Back Squat, Front Squat, Lunge, Hip Thrust
   - Shoulders: Overhead Press, Lateral Raise
   - Arms: Biceps Curl, Triceps Extension
   - Include an "Add custom exercise" option.
2. **Exercise screen** (after tapping an exercise):
   - Calendar view (month grid) to pick a date; default today; dates with logged sets for this exercise are marked with a dot
   - Below the calendar: up to **5 sets**, each with weight (kg, decimals allowed, step 2.5) and reps (integer)
   - Show 5 rows; empty rows are ignored on save
   - Save button; reopening a date loads the existing sets for editing; option to delete the day's entry
   - Small "last time" hint: sets from the most recent previous date for this exercise
3. **History** (per exercise, reachable from the exercise screen): list of dates with sets, plus a simple chart of the top set weight over time

## Data model (Supabase)
- `exercises`: id (uuid), user_id (uuid, null for built-in defaults), name, category, created_at
- `workout_sets`: id (uuid), user_id (uuid, default auth.uid()), exercise_id (fk), date (date), set_number (int, 1-5), weight_kg (numeric), reps (int), created_at
- Unique constraint on (user_id, exercise_id, date, set_number); upsert on save
- Check constraints: set_number between 1 and 5, weight_kg >= 0, reps > 0

## Security (important, the app is publicly reachable)
- Enable Row Level Security on every table
- Policies: users can select/insert/update/delete only rows where `user_id = auth.uid()`; built-in exercises (user_id is null) are readable by all authenticated users
- Provide the SQL (tables, RLS policies, seed data for default exercises) in `supabase/schema.sql`
- Restrict sign-ups to my account if possible (disable public sign-ups after first login)

## Features to add later (not in the first version)
- CSV export of all sets (for Stata/Excel)
- Personal records per exercise
- Offline queue so logging works with bad gym reception

## Working style
- Build in small steps and stop after each so I can test: (1) project scaffold + PWA setup, (2) Supabase schema + login, (3) Home screen, (4) exercise screen with calendar and set entry, (5) history/chart, (6) GitHub Pages deployment
- Mobile-first: large touch targets, numeric keypad for weight/reps (`inputMode="decimal"` / `"numeric"`)
- Keep dependencies minimal; explain any new package before adding it
- Keep code simple and readable; I am not a professional web developer
- After each step, tell me exactly what to run or click to test it, and what manual setup (Supabase, GitHub settings) I need to do myself
