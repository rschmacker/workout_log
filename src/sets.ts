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
