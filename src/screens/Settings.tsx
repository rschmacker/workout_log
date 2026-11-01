import { useMemo, useState, type FormEvent } from 'react'
import BackLink from '../components/BackLink'
import { buildExportRows, toGermanCsv } from '../csv'
import { todayISO } from '../dates'
import { useMyEntries } from '../entries'
import { useExercises } from '../exercises'
import { loadingError } from '../localData'
import { clearOutbox, useOutbox } from '../outbox'
import { saveMyName, useProfiles } from '../profiles'
import { useMySets } from '../sets'
import { errorText, supabase } from '../supabase'
import { useUserId } from '../useUserId'

// Hands the file to the user: on a phone via the share sheet ("Save to Files",
// AirDrop, Mail …), which also works in the Home Screen app; otherwise as a download.
async function deliverFile(file: File): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const isPhone = window.matchMedia('(pointer: coarse)').matches
  if (isPhone && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled' // closed the share sheet
      // Sharing not allowed: fall back to a download below
    }
  }
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return 'downloaded'
}

// Your display name, shown to your friends, e.g. "by <name>" on your workouts
function NameSetting() {
  const myUserId = useUserId()
  const profiles = useProfiles()
  const savedName = (myUserId && profiles?.get(myUserId)) || ''
  const [typed, setTyped] = useState<string | null>(null) // null = nothing typed, show the saved name
  const name = typed ?? savedName
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!myUserId) return
    setBusy(true)
    setMessage(null)
    const error = await saveMyName(myUserId, name)
    setBusy(false)
    if (error) {
      setMessage({ kind: 'error', text: `Could not save: ${errorText(error)}` })
    } else {
      setTyped(null)
      setMessage({ kind: 'ok', text: 'Saved ✓' })
    }
  }

  return (
    <section className="section">
      <h2>Your name</h2>
      <form className="stack" onSubmit={save}>
        <label className="field">
          Shown to your friends, e.g. "by {savedName || 'you'}" on your workouts
          <input
            type="text"
            autoCapitalize="words"
            maxLength={40}
            required
            value={name}
            onChange={(e) => {
              setTyped(e.target.value)
              setMessage(null)
            }}
          />
        </label>
        <button
          className="button secondary"
          disabled={busy || name.trim() === '' || name.trim() === savedName}
        >
          Save name
        </button>
        {message && <p className={message.kind === 'error' ? 'error' : 'success'}>{message.text}</p>}
      </form>
    </section>
  )
}

export default function Settings({ email }: { email: string | undefined }) {
  // Ready when the screen opens, so the export button can hand over the file
  // right away (the iPhone share sheet only opens directly after a tap)
  const setsState = useMySets()
  const exercisesState = useExercises()
  const entriesState = useMyEntries()
  const loadError = loadingError(setsState, exercisesState, entriesState)
  const [message, setMessage] = useState<string | null>(null)
  const outbox = useOutbox()
  const myUserId = useUserId()
  const [signOutError, setSignOutError] = useState<string | null>(null)

  const sets = setsState.data
  const exercises = exercisesState.data
  const entries = entriesState.data
  const rows = useMemo(
    () => (sets && exercises && entries ? buildExportRows(sets, exercises, entries) : null),
    [sets, exercises, entries],
  )

  async function exportCsv() {
    if (!rows) return
    setMessage(null)
    const file = new File([toGermanCsv(rows)], `workout-log-${todayISO()}.csv`, {
      type: 'text/csv',
    })
    const result = await deliverFile(file)
    if (result === 'shared') setMessage(`Exported ${rows.length} sets.`)
    if (result === 'downloaded') setMessage(`Downloaded ${file.name} (${rows.length} sets).`)
  }

  // Signing out deletes everything on this phone, also what isn't uploaded yet
  async function signOut() {
    const waiting = outbox.changes.length
    if (
      waiting > 0 &&
      !window.confirm(
        `${waiting} saved ${waiting === 1 ? 'entry is' : 'entries are'} not uploaded yet and will be lost. Sign out anyway?`,
      )
    ) {
      return
    }
    setSignOutError(null)
    const { error } = await supabase.auth.signOut()
    if (error) setSignOutError(errorText(error.message))
    else if (myUserId) clearOutbox(myUserId)
  }

  return (
    <main className="page">
      <BackLink parent="/" />
      <h1>Settings</h1>

      <NameSetting />

      <section className="section">
        <h2>Export</h2>
        <p className="muted">
          All your sets as a CSV file for Excel (German format: semicolons, decimal comma,
          dates as DD.MM.YYYY).
        </p>
        {loadError && <p className="error">Could not load your data: {loadError}</p>}
        <div className="stack">
          <button className="button" disabled={!rows} onClick={exportCsv}>
            {rows ? `Export CSV (${rows.length} sets)` : 'Loading…'}
          </button>
          {message && <p className="success">{message}</p>}
        </div>
      </section>

      <section className="section">
        <h2>Account</h2>
        <p>
          Signed in as <strong>{email}</strong>
        </p>
        <div className="stack">
          <button className="button secondary" onClick={signOut}>
            Sign out
          </button>
          {signOutError && <p className="error">{signOutError}</p>}
        </div>
      </section>
    </main>
  )
}
