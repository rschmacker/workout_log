# Saved workouts

Each file in this folder (`workouts/*.json`) is one saved workout. They appear in the
app under **Home → Workouts → Upper body / Lower body / Full body**.

The files are bundled into the app when it is built. To add or change a workout:
edit a file here, commit and push. GitHub then rebuilds the app (about 2 minutes).
If a file has a mistake, the build stops and the GitHub Actions log (or the terminal
running `npm run dev`) says exactly which file and what to fix. The live app stays
unchanged until the mistake is fixed.

## File name

Lowercase letters, digits and dashes, ending in `.json`, e.g. `upper-a.json`.
The file name is used in the app's web address, so renaming a file breaks links to it.

## Workout fields

| Field      | Required | What it is |
|------------|----------|------------|
| `name`     | no       | Name shown in the app. Without it, the name is made from all main exercises, e.g. "BB Bench Press + Pull-Up" |
| `category` | yes      | `"upper body"`, `"lower body"` or `"full body"` |
| `warmup`   | no       | List of text lines, shown as written (nothing is logged). Lines starting with `- ` become bullet points under the line above, e.g. `["2 Rounds:", "- 10 Ring Rows", "- 10 Push Ups"]` |
| `main`     | yes      | List of main items: single exercises and/or supersets (see below) |
| `finisher` | no       | List of text lines, shown like the warmup (nothing is logged). To log a finisher exercise, add it to `main` instead, e.g. with `"title": "Finisher (optional)"` |

## Main items

A main item is either **one exercise** or a **superset**:

```json
{ "exercise": "Deadlift", "sets": 5, "reps": "6-8" }

{ "superset": [
    { "exercise": "DB Bench Press", "sets": 4, "reps": "8-10" },
    { "exercise": "Inverted Row", "category": "Back", "sets": 5, "reps": "12-15" }
] }
```

Both kinds can also have:

| Field   | What it is |
|---------|------------|
| `title` | e.g. `"Chest & Lat Pump"` |
| `time`  | e.g. `"18 min"` (a plain number means minutes) |
| `cues`  | List of short texts shown with it, e.g. `["RIR 1-2", "3 sec eccentric", ">2 min rest"]` |

In a superset, `title`, `time` and `cues` go on the superset, not on its exercises.
The app shows a superset as one group ("Superset · 5 rounds", from the highest
`sets`); on the set entry screen a "Go to …" button switches to the other exercise(s)
of the superset, saving the current one first.

Each **exercise** has:

| Field      | Required | What it is |
|------------|----------|------------|
| `exercise` | yes      | Exercise name, e.g. `"DB Bench Press"` (built-in names, see below) |
| `sets`     | yes      | Number of sets, 1 to 5. Only this many set rows are shown |
| `reps`     | no       | Hint shown above the sets, e.g. `"8-10"`, `10`, `"max"` or `"9 + 9 m"` |
| `weight`   | no       | Hint shown above the sets, e.g. `"RPE 8"` or `"60 kg"` |
| `note`     | no       | Besonderheit, e.g. `"wide grip"`; prefilled in the note field |
| `category` | only for new exercises | Body part of an exercise that isn't built in: `Chest`, `Back`, `Legs`, `Shoulders`, `Arms` or `Core` |

An exercise can appear only once per workout (sets are saved per exercise and day).
For bodyweight exercises, leave the weight empty when logging: it is saved as
bodyweight ("BW").

## Variations vs. new exercises

- **Same movement, different grip / tempo / stance / load** → use the base exercise
  and put the difference in `note`. Example: wide grip DB bench press is
  `{ "exercise": "DB Bench Press", "note": "wide grip" }`. It is logged under
  DB Bench Press, and "wide grip" shows next to the sets in the history. No new
  exercise appears on the Home screen.
  If you write `"Wide Grip DB Bench Press"`, the build stops and suggests this.
- **Genuinely different movement** that isn't built in → give it a `category`, e.g.
  `{ "exercise": "Goblet Squat", "category": "Legs", "sets": 3 }`. The app creates it
  once as your own exercise, so it appears in that body part's list on the Home screen.
  If you already have an exercise with that name, it is used instead.

Built-in exercises: DB Bench Press, BB Bench Press, Incline DB Press, Dip, Deadlift,
Romanian Deadlift, Bent-Over Row, Pull-Up, Gorilla Row, Chin-Up, Back Squat,
Front Squat, Lunge, Hip Thrust, Strict Press, DDB Overhead Press, Lateral Raise,
Biceps Curl, Triceps Extension, Skullcrusher. (The list is in `src/builtInExercises.ts`; new
built-in exercises also need to be added to the database, see `supabase/`.)

## Example

`full-body-a.json`:

```json
{
  "name": "Full body A",
  "category": "full body",
  "warmup": ["3 Rounds:", "- 10 Slow Deadlifts", "- 10 Ring Rows", "- 10 Push Ups"],
  "main": [
    {
      "title": "Glute & Hamstring Pump",
      "time": "15 min",
      "exercise": "Deadlift",
      "sets": 5,
      "reps": "6-8",
      "cues": ["RIR 1-2", "2 sec eccentric", ">2 min rest"]
    },
    {
      "superset": [
        { "exercise": "Chin-Up", "note": "narrow grip", "sets": 4, "reps": "8-10" },
        { "exercise": "DDB Overhead Press", "note": "seated", "sets": 4, "reps": "8-10" }
      ],
      "cues": ["~2 min rest"]
    }
  ],
  "finisher": ["Plank 3 x 45 s"]
}
```

The real workouts in this folder are further examples.
