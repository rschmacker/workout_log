import { localData, useLocalData } from './localData'
import { supabase } from './supabase'

// One row of exercise_entries: per exercise and day, the "Besonderheiten" note and
// the saved workout it was logged from (either can be empty)
export type ExerciseEntry = {
  exercise_id: string
  date: string // "YYYY-MM-DD"
  note: string | null
  workout: string | null
}

// Loads the entries of all your exercises, oldest first.
// Supabase returns at most 1000 rows per request, so we fetch in pages.
async function fetchEntries(): Promise<ExerciseEntry[]> {
  const pageSize = 1000
  const all: ExerciseEntry[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('exercise_entries')
      .select('exercise_id, date, note, workout')
      .order('date')
      .order('exercise_id')
      .range(from, from + pageSize - 1)
    if (error) throw error
    all.push(...(data as ExerciseEntry[]))
    if (data.length < pageSize) return all
  }
}

// All your entries, with a copy on this phone (see localData.ts)
export const myEntries = localData('entries', fetchEntries)
export const useMyEntries = () => useLocalData(myEntries)

function entryFor(entries: ExerciseEntry[], exerciseId: string, date: string) {
  return entries.find((e) => e.exercise_id === exerciseId && e.date === date)
}

// The note of one exercise on one day ('' if there is none)
export function noteFor(entries: ExerciseEntry[], exerciseId: string, date: string): string {
  return entryFor(entries, exerciseId, date)?.note ?? ''
}

// The saved workout one exercise was logged from on one day ('' if none)
export function workoutFor(entries: ExerciseEntry[], exerciseId: string, date: string): string {
  return entryFor(entries, exerciseId, date)?.workout ?? ''
}

// Saves the note and workout of one exercise and day; if both are empty, the entry
// is removed. user_id is filled in by the database. Returns an error message or null.
export async function saveEntry(
  exerciseId: string,
  date: string,
  note: string,
  workout: string,
): Promise<string | null> {
  const text = note.trim()
  const keep = text !== '' || workout !== ''
  const { error } = keep
    ? await supabase
        .from('exercise_entries')
        .upsert(
          { exercise_id: exerciseId, date, note: text || null, workout: workout || null },
          { onConflict: 'user_id,exercise_id,date' },
        )
    : await supabase
        .from('exercise_entries')
        .delete()
        .eq('exercise_id', exerciseId)
        .eq('date', date)
  if (error) return error.message

  // Update the copy on this phone (same order as fetchEntries)
  myEntries.change((all) => {
    const others = all.filter((e) => e.exercise_id !== exerciseId || e.date !== date)
    if (!keep) return others
    const entry = { exercise_id: exerciseId, date, note: text || null, workout: workout || null }
    return [...others, entry].sort(
      (a, b) => a.date.localeCompare(b.date) || a.exercise_id.localeCompare(b.exercise_id),
    )
  })
  return null
}
