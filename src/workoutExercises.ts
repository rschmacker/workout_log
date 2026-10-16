import type { Exercise } from './exercises'
import { supabase } from './supabase'
import { WORKOUTS } from './workouts'

// Finds the exercises used in the workout files, by name (lowercase).
// Exercises that are new in a workout file (they have a "category") and that you
// don't have yet are created once as your own exercises, so they also appear on
// the Home screen. Runs once per app start; later calls reuse the result.
let result: Promise<Map<string, Exercise>> | null = null

export function workoutExercises(): Promise<Map<string, Exercise>> {
  result ??= load().catch((e) => {
    result = null // try again next time
    throw e
  })
  return result
}

// After signing out, the next user needs their own lookup
export function forgetWorkoutExercises() {
  result = null
}

async function load(): Promise<Map<string, Exercise>> {
  // Row Level Security only returns the built-in exercises plus your own
  const { data, error } = await supabase.from('exercises').select('id, user_id, name, category')
  if (error) throw error
  const byName = new Map((data as Exercise[]).map((e) => [e.name.toLowerCase(), e]))

  const missing = new Map<string, { name: string; category: Exercise['category'] }>()
  for (const workout of WORKOUTS) {
    for (const m of workout.exercises) {
      const key = m.exercise.toLowerCase()
      if (m.category && !byName.has(key)) missing.set(key, { name: m.exercise, category: m.category })
    }
  }

  if (missing.size > 0) {
    // user_id is filled in by the database
    const { data: created, error: createError } = await supabase
      .from('exercises')
      .insert([...missing.values()])
      .select('id, user_id, name, category')
    if (createError) throw createError
    for (const e of created as Exercise[]) byName.set(e.name.toLowerCase(), e)
  }
  return byName
}
