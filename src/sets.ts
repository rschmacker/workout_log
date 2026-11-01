import { localData, useLocalData } from './localData'
import { supabase } from './supabase'

export const MAX_SETS = 5

export type WorkoutSet = {
  date: string // "YYYY-MM-DD"
  set_number: number // 1-5
  weight_kg: number
  reps: number
}

export type LoggedSet = WorkoutSet & { exercise_id: string }

// Loads all your sets (all exercises), oldest first.
// Supabase returns at most 1000 rows per request, so we fetch in pages.
async function fetchEverySet(): Promise<LoggedSet[]> {
  const pageSize = 1000
  const all: LoggedSet[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('workout_sets')
      .select('exercise_id, date, set_number, weight_kg, reps')
      .order('date')
      .order('exercise_id')
      .order('set_number')
      .range(from, from + pageSize - 1)
    if (error) throw error
    all.push(...(data as LoggedSet[]))
    if (data.length < pageSize) return all
  }
}

// All your sets, with a copy on this phone (see localData.ts)
export const mySets = localData('sets', fetchEverySet)
export const useMySets = () => useLocalData(mySets)

// The same order as fetchEverySet: date, exercise, set number
const bySetOrder = (a: LoggedSet, b: LoggedSet) =>
  a.date.localeCompare(b.date) ||
  a.exercise_id.localeCompare(b.exercise_id) ||
  a.set_number - b.set_number

// After saving: put the sets of one exercise and day into the copy on this phone
function replaceDayInCopy(exerciseId: string, date: string, daySets: LoggedSet[]) {
  mySets.change((all) =>
    [...all.filter((s) => s.exercise_id !== exerciseId || s.date !== date), ...daySets].sort(
      bySetOrder,
    ),
  )
}

// Saves the sets of one exercise and day. Sets that were saved before but are not in
// the list anymore (e.g. set 4 was cleared) are removed. Returns an error message or null.
export async function saveDaySets(
  exerciseId: string,
  date: string,
  daySets: WorkoutSet[],
): Promise<string | null> {
  const rows = daySets.map((s) => ({ ...s, exercise_id: exerciseId, date }))

  // 1. Remove sets that were saved before but are now empty
  const keptNumbers = rows.map((s) => s.set_number).join(',')
  const { error: deleteError } = await supabase
    .from('workout_sets')
    .delete()
    .eq('exercise_id', exerciseId)
    .eq('date', date)
    .not('set_number', 'in', `(${keptNumbers})`)
  if (deleteError) return deleteError.message

  // 2. Insert new sets, overwrite existing ones (user_id is filled in by the database)
  const { error } = await supabase
    .from('workout_sets')
    .upsert(rows, { onConflict: 'user_id,exercise_id,date,set_number' })
  if (error) return error.message

  replaceDayInCopy(exerciseId, date, rows)
  return null
}

// Deletes all sets of one exercise and day. Returns an error message or null.
export async function deleteDaySets(exerciseId: string, date: string): Promise<string | null> {
  const { error } = await supabase
    .from('workout_sets')
    .delete()
    .eq('exercise_id', exerciseId)
    .eq('date', date)
  if (error) return error.message
  replaceDayInCopy(exerciseId, date, [])
  return null
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
// (like the copy of your sets).
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

// "100 kg × 8", or "BW × 12" for a bodyweight set (0 kg)
export function describeSet(s: { weight_kg: number; reps: number }): string {
  return `${s.weight_kg === 0 ? 'BW' : `${formatWeight(s.weight_kg)} kg`} × ${s.reps}`
}

// Short form for lists: "100 × 8", or "BW × 12"
export function shortSet(s: { weight_kg: number; reps: number }): string {
  return `${s.weight_kg === 0 ? 'BW' : formatWeight(s.weight_kg)} × ${s.reps}`
}
