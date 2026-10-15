import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import Calendar from '../components/Calendar'
import EditExercise from '../components/EditExercise'
import { formatDay, todayISO } from '../dates'
import type { Exercise } from '../exercises'
import {
  MAX_SETS,
  fetchAllSets,
  formatWeight,
  parseReps,
  parseWeight,
  type WorkoutSet,
} from '../sets'
import { supabase } from '../supabase'

const WEIGHT_STEP = 2.5
const PREVIOUS_SESSIONS = 3 // how many earlier sessions to show above the set rows

// What is typed into one row (kept as text so "62," doesn't jump around while typing)
type RowInput = { weight: string; reps: string }

function emptyRows(): RowInput[] {
  return Array.from({ length: MAX_SETS }, () => ({ weight: '', reps: '' }))
}

// Fill the 5 rows with the saved sets of one date
function rowsForDate(sets: WorkoutSet[], date: string): RowInput[] {
  const rows = emptyRows()
  for (const s of sets) {
    if (s.date === date) {
      rows[s.set_number - 1] = { weight: formatWeight(s.weight_kg), reps: String(s.reps) }
    }
  }
  return rows
}

export default function ExerciseScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [sets, setSets] = useState<WorkoutSet[] | null>(null) // all sets of this exercise
  const [date, setDate] = useState(todayISO())
  const [rows, setRows] = useState<RowInput[]>(emptyRows)
  const [dirty, setDirty] = useState(false) // unsaved changes in the rows?
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(
    null,
  )

  // When the screen opens: load the exercise and all its sets
  useEffect(() => {
    supabase
      .from('exercises')
      .select('id, user_id, name, category')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) setLoadError(error.message)
        else setExercise(data as Exercise)
      })
    fetchAllSets(id)
      .then((all) => {
        setSets(all)
        setRows(rowsForDate(all, todayISO()))
      })
      .catch((e: Error) => setLoadError(e.message))
  }, [id])

  // Reload all sets after saving or deleting, and refill the rows of that date
  async function reloadSets(forDate: string) {
    try {
      const all = await fetchAllSets(id)
      setSets(all)
      setRows(rowsForDate(all, forDate))
      setDirty(false)
    } catch (e) {
      setMessage({ kind: 'error', text: `Could not reload: ${(e as Error).message}` })
    }
  }

  const loggedDates = useMemo(() => new Set((sets ?? []).map((s) => s.date)), [sets])
  const hasSavedSets = loggedDates.has(date)

  // Previous sessions: the sets of the 3 most recent dates before the selected one, newest first
  const previousSessions = useMemo(() => {
    const earlier = [...loggedDates].filter((d) => d < date).sort().reverse()
    return earlier.slice(0, PREVIOUS_SESSIONS).map((d) => ({
      date: d,
      sets: (sets ?? []).filter((s) => s.date === d),
    }))
  }, [loggedDates, sets, date])

  function selectDate(newDate: string) {
    if (newDate === date) return
    if (dirty && !window.confirm('You have unsaved changes. Discard them?')) return
    setDate(newDate)
    setRows(rowsForDate(sets ?? [], newDate))
    setDirty(false)
    setMessage(null)
  }

  function updateRow(index: number, field: keyof RowInput, value: string) {
    setRows((old) => old.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
    setDirty(true)
    setMessage(null)
  }

  // The − / + buttons next to the weight field
  function stepWeight(index: number, delta: number) {
    const current = parseWeight(rows[index].weight) ?? 0
    updateRow(index, 'weight', formatWeight(Math.max(0, current + delta)))
  }

  async function save(e: FormEvent) {
    e.preventDefault()

    // Check the rows; completely empty rows are skipped
    const toSave = []
    for (let i = 0; i < MAX_SETS; i++) {
      const { weight, reps } = rows[i]
      if (weight.trim() === '' && reps.trim() === '') continue
      const weightKg = parseWeight(weight)
      const repCount = parseReps(reps)
      if (weightKg === null) {
        setMessage({ kind: 'error', text: `Set ${i + 1}: enter a weight like 60 or 62.5.` })
        return
      }
      if (repCount === null) {
        setMessage({ kind: 'error', text: `Set ${i + 1}: enter the reps as a whole number.` })
        return
      }
      toSave.push({ exercise_id: id, date, set_number: i + 1, weight_kg: weightKg, reps: repCount })
    }
    if (toSave.length === 0) {
      setMessage({
        kind: 'error',
        text: 'Enter at least one set, or use "Delete this day" to remove the entry.',
      })
      return
    }

    setBusy(true)
    setMessage(null)

    // 1. Remove sets that were saved before but are now empty (e.g. set 4 was cleared)
    const keptNumbers = toSave.map((s) => s.set_number).join(',')
    const { error: deleteError } = await supabase
      .from('workout_sets')
      .delete()
      .eq('exercise_id', id)
      .eq('date', date)
      .not('set_number', 'in', `(${keptNumbers})`)

    // 2. Insert new sets, overwrite existing ones (user_id is filled in by the database)
    const { error: upsertError } = deleteError
      ? { error: null }
      : await supabase
          .from('workout_sets')
          .upsert(toSave, { onConflict: 'user_id,exercise_id,date,set_number' })

    const error = deleteError ?? upsertError
    if (error) {
      setMessage({ kind: 'error', text: `Could not save: ${error.message}` })
    } else {
      await reloadSets(date)
      setMessage({ kind: 'ok', text: 'Saved ✓' })
    }
    setBusy(false)
  }

  async function deleteDay() {
    if (!window.confirm(`Delete all sets for ${formatDay(date)}?`)) return
    setBusy(true)
    setMessage(null)
    const { error } = await supabase
      .from('workout_sets')
      .delete()
      .eq('exercise_id', id)
      .eq('date', date)
    if (error) {
      setMessage({ kind: 'error', text: `Could not delete: ${error.message}` })
    } else {
      await reloadSets(date)
      setMessage({ kind: 'ok', text: 'Deleted' })
    }
    setBusy(false)
  }

  if (loadError) {
    return (
      <main className="page">
        <Link className="back-link" to="/">
          ‹ Back
        </Link>
        <p className="error">Could not load exercise: {loadError}</p>
      </main>
    )
  }

  if (!exercise || !sets) {
    return (
      <main className="page">
        <p className="muted">Loading…</p>
      </main>
    )
  }

  const isCustom = exercise.user_id !== null

  return (
    <main className="page">
      <Link className="back-link" to="/">
        ‹ Back
      </Link>

      <header className="topbar">
        <h1>{exercise.name}</h1>
        {isCustom && (
          <button className="link-button" onClick={() => setEditing(!editing)}>
            {editing ? 'Close' : 'Edit'}
          </button>
        )}
      </header>

      {editing && (
        <EditExercise
          exercise={exercise}
          onRenamed={(name) => {
            setExercise({ ...exercise, name })
            setEditing(false)
          }}
          onDeleted={() => navigate('/')}
        />
      )}

      <Calendar selected={date} onSelect={selectDate} markedDates={loggedDates} />

      <h2 className="day-title">{formatDay(date)}</h2>

      {previousSessions.length > 0 && (
        <ul className="last-time">
          {previousSessions.map((session) => (
            <li key={session.date}>
              <span className="muted">{formatDay(session.date)}:</span>{' '}
              {session.sets
                .map((s) => `${formatWeight(s.weight_kg)} × ${s.reps}`)
                .join(' · ')}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={save}>
        <div className="set-table">
          <span className="set-head">Set</span>
          <span className="set-head set-head-weight">Weight (kg)</span>
          <span className="set-head">Reps</span>

          {rows.map((row, i) => (
            <div key={i} className="set-row">
              <span className="set-number">{i + 1}</span>
              <div className="weight-input">
                <button
                  type="button"
                  className="step-button"
                  aria-label={`Set ${i + 1}: weight minus ${WEIGHT_STEP} kg`}
                  onClick={() => stepWeight(i, -WEIGHT_STEP)}
                >
                  −
                </button>
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label={`Set ${i + 1} weight in kg`}
                  value={row.weight}
                  onChange={(e) => updateRow(i, 'weight', e.target.value)}
                />
                <button
                  type="button"
                  className="step-button"
                  aria-label={`Set ${i + 1}: weight plus ${WEIGHT_STEP} kg`}
                  onClick={() => stepWeight(i, WEIGHT_STEP)}
                >
                  +
                </button>
              </div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                aria-label={`Set ${i + 1} reps`}
                value={row.reps}
                onChange={(e) => updateRow(i, 'reps', e.target.value)}
              />
            </div>
          ))}
        </div>

        <div className="stack">
          <button className="button" disabled={busy}>
            {hasSavedSets ? 'Save changes' : 'Save'}
          </button>
          {message && (
            <p className={message.kind === 'error' ? 'error' : 'success'}>{message.text}</p>
          )}
          {hasSavedSets && (
            <button
              type="button"
              className="link-button danger-text"
              disabled={busy}
              onClick={deleteDay}
            >
              Delete this day
            </button>
          )}
        </div>
      </form>
    </main>
  )
}
