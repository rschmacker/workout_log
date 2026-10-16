import { parseWorkout, type Block, type Workout, type WorkoutCategory } from './workoutFormat'

// Types of saved workouts, shown in the "Workouts" section of the Home screen
export const WORKOUT_TYPES: { slug: string; label: string; category: WorkoutCategory }[] = [
  { slug: 'upper-body', label: 'Upper body', category: 'upper body' },
  { slug: 'lower-body', label: 'Lower body', category: 'lower body' },
  { slug: 'full-body', label: 'Full body', category: 'full body' },
]

// All workout files (workouts/*.json), bundled into the app when it is built.
// They were already checked during the build, so parsing them here can't fail.
const files = import.meta.glob('/workouts/*.json', { eager: true, import: 'default' })

export const WORKOUTS: Workout[] = Object.entries(files)
  .map(([path, json]) => parseWorkout(path.split('/').pop()!, json).workout)
  .filter((w): w is Workout => w !== null)
  .sort((a, b) => a.name.localeCompare(b.name))

export function findWorkout(slug: string | null | undefined): Workout | null {
  return WORKOUTS.find((w) => w.slug === slug) ?? null
}

export function workoutTypeOf(workout: Workout) {
  return WORKOUT_TYPES.find((t) => t.category === workout.category)!
}

// The block (single exercise or superset) that contains main exercise number `index`
export function blockOf(workout: Workout, index: number): Block | null {
  return workout.blocks.find((b) => b.exercises.some((e) => e.index === index)) ?? null
}

// "4 sets · 6-8 reps · RPE 8". "reps" is only added to plain numbers like "8-10",
// "10/10" or "max", not to hints like "9 + 9 m".
export function prescription(m: { sets: number; reps: string; weight: string }): string {
  const reps = /^([\d\s/+-]+|max)$/i.test(m.reps) ? `${m.reps} reps` : m.reps
  return [`${m.sets} ${m.sets === 1 ? 'set' : 'sets'}`, reps, m.weight]
    .filter(Boolean)
    .join(' · ')
}

// "Chest & Lat Pump · 18 min"
export function blockHeading(block: Block): string {
  return [block.title, block.time && (/^\d+$/.test(block.time) ? `${block.time} min` : block.time)]
    .filter(Boolean)
    .join(' · ')
}
