import { localData, useLocalData } from './localData'
import { pendingChanges } from './outbox'
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

// The list of entries with the note and workout of one exercise and day replaced
// (both empty = no entry), in the same order as fetchEntries
function setEntry(
  all: ExerciseEntry[],
  exerciseId: string,
  date: string,
  note: string,
  workout: string,
): ExerciseEntry[] {
  const others = all.filter((e) => e.exercise_id !== exerciseId || e.date !== date)
  if (!note && !workout) return others
  const entry = { exercise_id: exerciseId, date, note: note || null, workout: workout || null }
  return [...others, entry].sort(
    (a, b) => a.date.localeCompare(b.date) || a.exercise_id.localeCompare(b.exercise_id),
  )
}

// All your entries, with a copy on this phone (see localData.ts). Days that are saved
// on this phone but not uploaded yet (outbox.ts) are shown as saved.
export const myEntries = localData('entries', async () =>
  pendingChanges().reduce(
    (all, c) => setEntry(all, c.exerciseId, c.date, c.note, c.workout),
    await fetchEntries(),
  ),
)
export const useMyEntries = () => useLocalData(myEntries)

// When saving: put the note and workout of one exercise and day into the copy on this phone
export function setEntryInCopy(exerciseId: string, date: string, note: string, workout: string) {
  myEntries.change((all) => setEntry(all, exerciseId, date, note, workout))
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
