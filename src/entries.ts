import { supabase } from './supabase'

// One row of exercise_entries: per exercise and day, the "Besonderheiten" note and
// the saved workout it was logged from (either can be empty)
export type ExerciseEntry = {
  exercise_id: string
  date: string // "YYYY-MM-DD"
  note: string | null
  workout: string | null
}

// Loads the entries of all your exercises, or of one exercise, oldest first.
// Supabase returns at most 1000 rows per request, so we fetch in pages.
export async function fetchEntries(exerciseId?: string): Promise<ExerciseEntry[]> {
  const pageSize = 1000
  const all: ExerciseEntry[] = []
  for (let from = 0; ; from += pageSize) {
    let query = supabase.from('exercise_entries').select('exercise_id, date, note, workout')
    if (exerciseId) query = query.eq('exercise_id', exerciseId)
    const { data, error } = await query
      .order('date')
      .order('exercise_id')
      .range(from, from + pageSize - 1)
    if (error) throw error
    all.push(...(data as ExerciseEntry[]))
    if (data.length < pageSize) return all
  }
}

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
  const { error } =
    text || workout
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
  return error ? error.message : null
}
