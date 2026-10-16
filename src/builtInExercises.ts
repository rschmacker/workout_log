// The built-in exercises, as seeded in supabase/schema.sql (keep both in sync).
// Used to check the workout files when the app is built.
export const BUILT_IN_EXERCISES = [
  { name: 'DB Bench Press', category: 'Chest' },
  { name: 'BB Bench Press', category: 'Chest' },
  { name: 'Incline DB Press', category: 'Chest' },
  { name: 'Dip', category: 'Chest' },
  { name: 'Deadlift', category: 'Back' },
  { name: 'Romanian Deadlift', category: 'Back' },
  { name: 'Bent-Over Row', category: 'Back' },
  { name: 'Pull-Up', category: 'Back' },
  { name: 'Gorilla Row', category: 'Back' },
  { name: 'Chin-Up', category: 'Back' },
  { name: 'Back Squat', category: 'Legs' },
  { name: 'Front Squat', category: 'Legs' },
  { name: 'Lunge', category: 'Legs' },
  { name: 'Hip Thrust', category: 'Legs' },
  { name: 'Strict Press', category: 'Shoulders' },
  { name: 'DDB Overhead Press', category: 'Shoulders' },
  { name: 'Lateral Raise', category: 'Shoulders' },
  { name: 'Biceps Curl', category: 'Arms' },
  { name: 'Triceps Extension', category: 'Arms' },
  { name: 'Skullcrusher', category: 'Arms' },
] as const
