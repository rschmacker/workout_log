import { useLayoutEffect, useSyncExternalStore } from 'react'

// A copy of the data on this phone (in the browser's localStorage), so screens open
// right away instead of waiting for Supabase. There is one copy per kind of data
// (exercises, workouts, names, your sets, your notes):
// - screens show the copy straight away,
// - if it is older than a minute, Supabase is asked again in the background and the
//   screen updates when the answer arrives (also when the app comes back to the front),
// - after you save something, the copy is updated right away.
// Copies are kept per user and deleted when you sign out.

const MAX_AGE_MS = 60_000
const BASE = 'workout-log-data:'
// Bump the number when the shape of the stored data changes, so old copies are ignored
const PREFIX = `${BASE}1:`

export type LocalState<T> = {
  data: T | undefined // undefined = nothing loaded yet (not even a copy on this phone)
  refreshing: boolean // asking Supabase right now
  error: string | null // the last request failed (the copy, if there is one, is still shown)
}

export type LocalData<T> = {
  getState: () => LocalState<T>
  subscribe: (listener: () => void) => () => void
  refreshIfOld: () => void
  // Ask Supabase again now, e.g. after a save whose result isn't known on the phone
  reload: () => Promise<void>
  // Update the copy after something was saved in Supabase
  change: (update: (data: T) => T) => void
}

let userId: string | null = null
const allCopies: { reset: () => void; refreshIfOld: () => void }[] = []

function storageKey(name: string) {
  return `${PREFIX}${userId}:${name}`
}

function readCopy<T>(name: string): T | undefined {
  if (!userId) return undefined
  try {
    const text = localStorage.getItem(storageKey(name))
    return text === null ? undefined : (JSON.parse(text) as T)
  } catch {
    return undefined
  }
}

function writeCopy(name: string, data: unknown) {
  if (!userId) return
  try {
    localStorage.setItem(storageKey(name), JSON.stringify(data))
  } catch {
    // Storage full or blocked: the copy just isn't kept for the next start
  }
}

function removeCopies(shouldRemove: (key: string) => boolean) {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(BASE) && shouldRemove(key)) localStorage.removeItem(key)
    }
  } catch {
    // Storage not available: nothing to remove
  }
}

// One kind of data. `load` gets all of it from Supabase.
export function localData<T>(name: string, load: () => Promise<T>): LocalData<T> {
  let state: LocalState<T> = { data: readCopy<T>(name), refreshing: false, error: null }
  let checkedAt = 0 // when Supabase last answered (0 = not since the app started)
  let version = 0 // goes up with every change of the copy, so outdated answers are ignored
  let running: { version: number; promise: Promise<void> } | null = null
  const listeners = new Set<() => void>()

  function update(patch: Partial<LocalState<T>>) {
    state = { ...state, ...patch }
    listeners.forEach((listener) => listener())
  }

  function refresh(): Promise<void> {
    if (running?.version === version) return running.promise // already asking
    const askedAt = version
    update({ refreshing: true })
    const promise = load()
      .then((data) => {
        // The copy was changed meanwhile (e.g. you saved): this answer may be outdated
        if (version !== askedAt) return
        checkedAt = Date.now()
        writeCopy(name, data)
        update({ data, error: null })
      })
      .catch((e: Error) => {
        if (version === askedAt) update({ error: e.message })
      })
      .finally(() => {
        if (running?.promise !== promise) return
        running = null
        update({ refreshing: false })
      })
    running = { version: askedAt, promise }
    return promise
  }

  const copy = {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    refreshIfOld() {
      if (userId && Date.now() - checkedAt > MAX_AGE_MS) refresh()
    },
    reload() {
      version++
      return refresh()
    },
    change(changeData: (data: T) => T) {
      if (state.data === undefined) return // not loaded yet: the next refresh gets it all
      version++
      const data = changeData(state.data)
      writeCopy(name, data)
      update({ data })
    },
    // Another user logged in (or out): start over with their copy
    reset() {
      version++
      checkedAt = 0
      running = null
      update({ data: readCopy<T>(name), refreshing: false, error: null })
    },
  }
  allCopies.push(copy)
  return copy
}

// For screens: the current state of a copy. If the copy is old, it's refreshed in the
// background. (useLayoutEffect, so "refreshing" is already set when the screen appears.)
export function useLocalData<T>(copy: LocalData<T>): LocalState<T> {
  const state = useSyncExternalStore(copy.subscribe, copy.getState)
  useLayoutEffect(() => copy.refreshIfOld(), [copy])
  return state
}

// The error to show if some data could not be loaded and there is no copy of it
export function loadingError(...states: LocalState<unknown>[]): string | null {
  return states.find((s) => s.data === undefined && s.error)?.error ?? null
}

// Called when the login is known: shows that user's copies (and deletes other users')
export function setLocalDataUser(id: string | null) {
  if (id === userId) return
  userId = id
  if (id) removeCopies((key) => !key.startsWith(`${PREFIX}${id}:`))
  allCopies.forEach((copy) => copy.reset())
}

// On sign out: delete all copies from this phone
export function clearLocalData() {
  removeCopies(() => true)
  userId = null
  allCopies.forEach((copy) => copy.reset())
}

export function refreshAllIfOld() {
  allCopies.forEach((copy) => copy.refreshIfOld())
}

export function currentUserId(): string | null {
  return userId
}

// When the app comes back to the front (e.g. opened again from the Home Screen)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshAllIfOld()
})
