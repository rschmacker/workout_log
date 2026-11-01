import { useSyncExternalStore } from 'react'
import { currentUserId } from './localData'
import type { WorkoutSet } from './sets'

// Logged days that are saved on this phone but not uploaded to Supabase yet, like an
// email outbox. Kept in localStorage per user, so they survive closing the app.
// saveDay.ts adds to it and uploads from it.

// One exercise on one day, as it should end up in Supabase
export type DayChange = {
  id: string // new for every save
  exerciseId: string
  date: string // "YYYY-MM-DD"
  sets: WorkoutSet[] // none = the day was deleted
  note: string
  workout: string // name of the saved workout it was logged from, or ''
}

export type OutboxState = {
  changes: DayChange[]
  problem: string | null // why the last upload didn't work (null = it did)
}

const KEY = 'workout-log-outbox:'
let state: OutboxState = { changes: [], problem: null }
let loadedFor: string | null = null // whose outbox is in memory
const listeners = new Set<() => void>()

// The outbox of the logged-in user (read from the phone the first time)
function current(): OutboxState {
  const userId = currentUserId()
  if (loadedFor !== userId) {
    loadedFor = userId
    let changes: DayChange[] = []
    try {
      changes = JSON.parse(localStorage.getItem(KEY + userId) ?? '[]')
    } catch {
      // Storage not available: start empty
    }
    state = { changes: userId ? changes : [], problem: null }
  }
  return state
}

function update(changes: DayChange[], problem: string | null) {
  state = { changes, problem }
  if (loadedFor) {
    try {
      localStorage.setItem(KEY + loadedFor, JSON.stringify(changes))
    } catch {
      // Storage full or blocked: the outbox is only kept until the app is closed
    }
  }
  listeners.forEach((listener) => listener())
}

export function pendingChanges(): DayChange[] {
  return current().changes
}

// A new save of a day replaces an older save of the same day that is still waiting
export function addChange(change: DayChange) {
  const others = current().changes.filter(
    (c) => c.exerciseId !== change.exerciseId || c.date !== change.date,
  )
  update([...others, change], current().problem)
}

export function removeChange(id: string) {
  update(
    current().changes.filter((c) => c.id !== id),
    current().problem,
  )
}

export function setProblem(problem: string | null) {
  if (problem !== current().problem) update(current().changes, problem)
}

// Only when you sign out (after a warning): what wasn't uploaded is lost
export function clearOutbox(userId: string) {
  try {
    localStorage.removeItem(KEY + userId)
  } catch {
    // Storage not available: nothing to remove
  }
  if (loadedFor === userId) {
    state = { changes: [], problem: null }
    listeners.forEach((listener) => listener())
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// For screens: the waiting changes, updated when they change
export function useOutbox(): OutboxState {
  return useSyncExternalStore(subscribe, current)
}
