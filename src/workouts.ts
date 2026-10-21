import type { Category } from './exercises'
import { supabase } from './supabase'
import { cleanLines, draftToRows, type Draft } from './workoutDraft'

// Saved workouts, stored in Supabase (tables workouts and workout_exercises) and
// shared between all users. This file loads them into the shape the screens use.

export const WORKOUT_CATEGORIES = ['upper body', 'lower body', 'full body'] as const
export type WorkoutCategory = (typeof WORKOUT_CATEGORIES)[number]

// Types of saved workouts, shown in the "Workouts" section of the Home screen
export const WORKOUT_TYPES: { slug: string; label: string; category: WorkoutCategory }[] = [
  { slug: 'upper-body', label: 'Upper body', category: 'upper body' },
  { slug: 'lower-body', label: 'Lower body', category: 'lower body' },
  { slug: 'full-body', label: 'Full body', category: 'full body' },
]

export type MainExercise = {
  index: number // position in the whole workout (0, 1, 2, …), used in the URL
  exerciseId: string
  exercise: string // exercise name
  category: Category
  note: string // Besonderheit, e.g. "wide grip"
  sets: number // prescribed number of sets (1-5)
  reps: string // hint, e.g. "6-8"
  weight: string // hint, e.g. "RPE 8" or "60 kg"
}

// One part of the main workout: a single exercise, or a superset of several
export type Block = {
  title: string // e.g. "Chest & Lat Pump"
  time: string // e.g. "18 min"
  cues: string[] // e.g. ["RIR 1-2", "3 sec eccentric", ">2 min rest"]
  exercises: MainExercise[] // more than one = superset
}

export type Workout = {
  id: string
  userId: string | null // creator; null = built-in (read-only)
  name: string // given, or made from the main exercises
  givenName: string // as stored: '' = named after the main exercises
  category: WorkoutCategory
  warmup: string[] // text lines
  finisher: string[] // text lines
  blocks: Block[]
  exercises: MainExercise[] // all main exercises of all blocks, in order
  updatedAt: string
  updatedBy: string | null
}

// A row of workout_exercises, with its exercise
type ExerciseRow = {
  position: number
  sets: number
  reps_hint: string
  weight_hint: string
  note: string
  superset_with_next: boolean
  title: string
  duration: string
  cues: string
  exercises: { id: string; name: string; category: Category }
}

type WorkoutRow = {
  id: string
  user_id: string | null
  name: string
  category: WorkoutCategory
  warmup: string
  finisher: string
  updated_at: string
  updated_by: string | null
  workout_exercises: ExerciseRow[]
}

const SELECT = `id, user_id, name, category, warmup, finisher, updated_at, updated_by,
  workout_exercises (position, sets, reps_hint, weight_hint, note, superset_with_next,
    title, duration, cues, exercises (id, name, category))`

const lines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

function toWorkout(row: WorkoutRow): Workout {
  const rows = [...row.workout_exercises].sort((a, b) => a.position - b.position)
  const exercises: MainExercise[] = rows.map((r, index) => ({
    index,
    exerciseId: r.exercises.id,
    exercise: r.exercises.name,
    category: r.exercises.category,
    note: r.note,
    sets: r.sets,
    reps: r.reps_hint,
    weight: r.weight_hint,
  }))

  // Exercises marked "superset with next" are grouped with the following one;
  // title, time and cues come from the first exercise of a group
  const blocks: Block[] = []
  rows.forEach((r, i) => {
    const previous = rows[i - 1]
    if (previous?.superset_with_next) {
      blocks[blocks.length - 1].exercises.push(exercises[i])
    } else {
      blocks.push({ title: r.title, time: r.duration, cues: lines(r.cues), exercises: [exercises[i]] })
    }
  })

  return {
    id: row.id,
    userId: row.user_id,
    // Without a name: the main exercises, e.g. "BB Bench Press + Pull-Up"
    name: row.name || exercises.map((e) => e.exercise).join(' + '),
    givenName: row.name,
    category: row.category,
    warmup: lines(row.warmup),
    finisher: lines(row.finisher),
    blocks,
    exercises,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  }
}

// All workouts of one type, sorted by name
export async function fetchWorkouts(category: WorkoutCategory): Promise<Workout[]> {
  const { data, error } = await supabase.from('workouts').select(SELECT).eq('category', category)
  if (error) throw error
  return (data as unknown as WorkoutRow[])
    .map(toWorkout)
    .sort((a, b) => a.name.localeCompare(b.name))
}

// One workout, or null if it doesn't exist (anymore)
export async function fetchWorkout(id: string): Promise<Workout | null> {
  // Not a valid id (e.g. an old link): don't even ask the database
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const { data, error } = await supabase.from('workouts').select(SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toWorkout(data as unknown as WorkoutRow) : null
}

// Saves a workout from the builder, all or nothing (database function save_workout).
// id null = new workout. expectedUpdatedAt: when the workout was last changed at the
// time it was opened; if someone saved it since, the error message starts with
// "WORKOUT_CHANGED". Pass null to overwrite anyway. Returns the workout's id.
export async function saveWorkout(
  id: string | null,
  draft: Draft,
  expectedUpdatedAt: string | null,
): Promise<string> {
  const { data, error } = await supabase.rpc('save_workout', {
    p_id: id,
    p_name: draft.name.trim(),
    p_category: draft.category,
    p_warmup: cleanLines(draft.warmup),
    p_finisher: cleanLines(draft.finisher),
    p_exercises: draftToRows(draft),
    p_expected_updated_at: expectedUpdatedAt,
  })
  if (error) throw error
  return data as string
}

// Deletes a workout (only its creator can; the database checks this)
export async function deleteWorkout(id: string): Promise<void> {
  const { data, error } = await supabase.from('workouts').delete().eq('id', id).select('id')
  if (error) throw error
  if (data.length === 0) throw new Error('Only the person who created this workout can delete it.')
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
