import { supabase } from './supabase'

export const MAX_SETS = 5

export type WorkoutSet = {
  date: string // "YYYY-MM-DD"
  set_number: number // 1-5
  weight_kg: number
  reps: number
}

// Loads all sets of one exercise, oldest first.
// Supabase returns at most 1000 rows per request, so we fetch in pages.
export async function fetchAllSets(exerciseId: string): Promise<WorkoutSet[]> {
  const pageSize = 1000
  const all: WorkoutSet[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('workout_sets')
      .select('date, set_number, weight_kg, reps')
      .eq('exercise_id', exerciseId)
      .order('date')
      .order('set_number')
      .range(from, from + pageSize - 1)
    if (error) throw error
    all.push(...(data as WorkoutSet[]))
    if (data.length < pageSize) return all
  }
}

// Loads all sets of all your exercises (for the CSV export), oldest first.
export async function fetchEverySet(): Promise<(WorkoutSet & { exercise_id: string })[]> {
  const pageSize = 1000
  const all: (WorkoutSet & { exercise_id: string })[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('workout_sets')
      .select('exercise_id, date, set_number, weight_kg, reps')
      .order('date')
      .order('exercise_id')
      .order('set_number')
      .range(from, from + pageSize - 1)
    if (error) throw error
    all.push(...(data as (WorkoutSet & { exercise_id: string })[]))
    if (data.length < pageSize) return all
  }
}

// Accepts "60", "62.5" and "62,5" (the iPhone keypad shows a comma in German).
// Returns null if it isn't a valid weight.
export function parseWeight(text: string): number | null {
  const s = text.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null
  const n = Number(s)
  return n <= 9999.99 ? n : null
}

export function parseReps(text: string): number | null {
  const s = text.trim()
  if (!/^\d+$/.test(s)) return null
  const n = Number(s)
  return n > 0 && n <= 9999 ? n : null
}

// 62.5 -> "62.5", 60 -> "60"
export function formatWeight(n: number): string {
  return String(Math.round(n * 100) / 100)
}

// Volume of one set = weight × reps
export function volume(s: { weight_kg: number; reps: number }): number {
  return s.weight_kg * s.reps
}

// 1250 -> "1,250 kg"
export function formatVolume(n: number): string {
  return `${n.toLocaleString('en-GB', { maximumFractionDigits: 2 })} kg`
}

// The best set by some score. On a tie, more reps wins; after that the earliest
// date (when it was first reached). Expects the sets sorted by date, oldest first
// (as fetchAllSets returns them).
function bestBy<T extends WorkoutSet>(sets: T[], score: (s: T) => number): T | null {
  let best: T | null = null
  for (const s of sets) {
    if (!best || score(s) > score(best) || (score(s) === score(best) && s.reps > best.reps)) {
      best = s
    }
  }
  return best
}

// Personal best by weight: the heaviest set
export function bestByWeight<T extends WorkoutSet>(sets: T[]): T | null {
  return bestBy(sets, (s) => s.weight_kg)
}

// Personal best by volume: the set with the highest weight × reps
export function bestByVolume<T extends WorkoutSet>(sets: T[]): T | null {
  return bestBy(sets, volume)
}

// "100 kg × 8"
export function describeSet(s: WorkoutSet): string {
  return `${formatWeight(s.weight_kg)} kg × ${s.reps}`
}
