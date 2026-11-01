import { myEntries, setEntryInCopy } from './entries'
import { addChange, pendingChanges, removeChange, setProblem, type DayChange } from './outbox'
import { mySets, replaceDayInCopy, type WorkoutSet } from './sets'
import { supabase } from './supabase'

// Saving the sets and note of one exercise on one day. It's saved on this phone right
// away (so it works without reception) and uploaded to Supabase in the background.
// If that doesn't work, it waits in the outbox (outbox.ts) and is tried again: when the
// app comes back to the front, when the connection is back, every 30 seconds, and
// after the next save.

const RETRY_MS = 30_000
// With bad reception a request can hang for a long time: give up after 20 seconds
// and try again later
const TIMEOUT_MS = 20_000

// Saves one exercise's day. No sets = delete the day (with its note).
export function saveDay(
  exerciseId: string,
  date: string,
  sets: WorkoutSet[],
  note: string,
  workout: string,
) {
  const change = { id: crypto.randomUUID(), exerciseId, date, sets, note: note.trim(), workout }
  replaceDayInCopy(exerciseId, date, sets)
  setEntryInCopy(exerciseId, date, change.note, workout)
  addChange(change)
  uploadPending()
}

// "Saved ✓", plus a hint if the phone knows it's offline (e.g. Airplane Mode)
export function savedText(text: string): string {
  return navigator.onLine === false
    ? `${text} on this phone – it syncs when you have reception.`
    : text
}

let running = false
let again = false // something was saved while uploading: go through the outbox again
let retryTimer: ReturnType<typeof setTimeout> | undefined

// Uploads everything in the outbox, one change after the other
export async function uploadPending() {
  if (running) {
    again = true
    return
  }
  running = true
  try {
    do {
      again = false
      await uploadAll()
    } while (again)
  } finally {
    running = false
  }
}

const NO_CONNECTION = 'No connection – it uploads automatically when you have reception.'

async function uploadAll() {
  clearTimeout(retryTimer)
  if (pendingChanges().length === 0) {
    setProblem(null)
    return
  }
  // Don't even try if the phone knows it's offline (e.g. Airplane Mode), or if the login
  // (it expires after an hour) couldn't be renewed yet because of the connection
  const offline =
    navigator.onLine === false || !(await supabase.auth.getSession()).data.session
  if (offline) {
    setProblem(NO_CONNECTION)
    retryTimer = setTimeout(uploadPending, RETRY_MS)
    return
  }
  let problem: string | null = null
  for (const change of pendingChanges()) {
    // Saved again meanwhile: the newer save replaced this one in the outbox
    if (!pendingChanges().some((c) => c.id === change.id)) continue
    const result = await upload(change)
    if (result === 'uploaded') {
      removeChange(change.id)
      // Answers to requests sent before this upload may not contain it yet
      mySets.change((all) => all)
      myEntries.change((all) => all)
    } else if (result === 'no connection') {
      problem = NO_CONNECTION
      break // no need to try the others now
    } else {
      problem = `Upload failed (${result}) – trying again automatically.`
    }
  }
  setProblem(problem)
  if (pendingChanges().length > 0) retryTimer = setTimeout(uploadPending, RETRY_MS)
}

type Response = { error: { message: string } | null; status: number }

// 'uploaded', 'no connection', or Supabase's error message
async function upload(change: DayChange): Promise<string> {
  const signal = AbortSignal.timeout(TIMEOUT_MS)
  const { exerciseId, date } = change
  const rows = change.sets.map((s) => ({ ...s, exercise_id: exerciseId, date }))
  // Status 0: the request didn't reach Supabase (no reception, or it took too long)
  const failure = (r: Response) => (r.status === 0 ? 'no connection' : r.error!.message)

  // 1. Remove sets that are not in the list (all of them if the day was deleted)
  let removeSets = supabase
    .from('workout_sets')
    .delete()
    .eq('exercise_id', exerciseId)
    .eq('date', date)
  if (rows.length > 0) {
    removeSets = removeSets.not('set_number', 'in', `(${rows.map((r) => r.set_number).join(',')})`)
  }
  const removed = await removeSets.abortSignal(signal)
  if (removed.error) return failure(removed)

  // 2. Insert new sets, overwrite existing ones (user_id is filled in by the database)
  if (rows.length > 0) {
    const saved = await supabase
      .from('workout_sets')
      .upsert(rows, { onConflict: 'user_id,exercise_id,date,set_number' })
      .abortSignal(signal)
    if (saved.error) return failure(saved)
  }

  // 3. The note and workout name ("Besonderheiten"); no entry if both are empty
  const entry =
    change.note || change.workout
      ? await supabase
          .from('exercise_entries')
          .upsert(
            {
              exercise_id: exerciseId,
              date,
              note: change.note || null,
              workout: change.workout || null,
            },
            { onConflict: 'user_id,exercise_id,date' },
          )
          .abortSignal(signal)
      : await supabase
          .from('exercise_entries')
          .delete()
          .eq('exercise_id', exerciseId)
          .eq('date', date)
          .abortSignal(signal)
  if (entry.error) return failure(entry)
  return 'uploaded'
}

// Try again when the app comes back to the front, or when the phone reports that
// the connection is back
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') uploadPending()
})
window.addEventListener('online', () => uploadPending())
