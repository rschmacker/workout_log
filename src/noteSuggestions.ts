// Autocomplete for the "Besonderheiten" field.

type NoteEntry = { exercise_id: string; date: string; note: string | null }

// Your earlier notes that contain what you typed (case-insensitive, anywhere in the
// text). Notes used for this exercise come first, then notes from other exercises;
// within each group the most recently used first. Each note appears only once.
export function suggestNotes(
  entries: NoteEntry[],
  exerciseId: string,
  typed: string,
  limit = 5,
): string[] {
  const query = typed.trim().toLowerCase()
  if (query === '') return []

  const newestFirst = [...entries].sort((a, b) => b.date.localeCompare(a.date))
  const seen = new Set([query]) // don't suggest exactly what is already typed
  const result: string[] = []

  const collect = (fromThisExercise: boolean) => {
    for (const entry of newestFirst) {
      if ((entry.exercise_id === exerciseId) !== fromThisExercise) continue
      const note = entry.note?.trim()
      if (!note) continue
      const key = note.toLowerCase()
      if (seen.has(key) || !key.includes(query)) continue
      seen.add(key)
      result.push(note)
    }
  }
  collect(true)
  collect(false)

  return result.slice(0, limit)
}
