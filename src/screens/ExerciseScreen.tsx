import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import Calendar from '../components/Calendar'
import EditExercise from '../components/EditExercise'
import PersonalBests from '../components/PersonalBests'
import { formatDay, todayISO } from '../dates'
import type { Exercise } from '../exercises'
import {
  MAX_SETS,
  bestByVolume,
  bestByWeight,
  describeSet,
  fetchAllSets,
  formatVolume,
  formatWeight,
  parseReps,
  parseWeight,
  volume,
  type WorkoutSet,
} from '../sets'
import {
  emptyRows,
  isPrefilled,
  isSkipped,
  prefillRow,
  updateRows,
  type RowInput,
} from '../setRows'
import { supabase } from '../supabase'

const WEIGHT_STEP = 2.5

// Fill the 5 rows with the saved sets of one date
function rowsForDate(sets: WorkoutSet[], date: string): RowInput[] {
  const rows = emptyRows(MAX_SETS)
  for (const s of sets) {
    if (s.date === date) {
      rows[s.set_number - 1] = {
        weight: formatWeight(s.weight_kg),
        reps: String(s.reps),
        ownWeight: true,
      }
    }
  }
  return rows
}

export default function ExerciseScreen() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Start on the date from the URL (e.g. coming from History), otherwise today
  const [initialDate] = useState(() => {
    const fromUrl = searchParams.get('date')
    return fromUrl && /^\d{4}-\d{2}-\d{2}$/.test(fromUrl) ? fromUrl : todayISO()
  })

  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [sets, setSets] = useState<WorkoutSet[] | null>(null) // all sets of this exercise
  const [date, setDate] = useState(initialDate)
  const [rows, setRows] = useState<RowInput[]>(() => emptyRows(MAX_SETS))
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
        setRows(rowsForDate(all, initialDate))
      })
      .catch((e: Error) => setLoadError(e.message))
  }, [id, initialDate])

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

  // "Last time": the sets of the most recent date before the selected one
  const lastSession = useMemo(() => {
    const lastDate = [...loggedDates].filter((d) => d < date).sort().at(-1)
    if (!lastDate || !sets) return null
    return { date: lastDate, sets: sets.filter((s) => s.date === lastDate) }
  }, [loggedDates, sets, date])

  function selectDate(newDate: string) {
    if (newDate === date) return
    if (dirty && !window.confirm('You have unsaved changes. Discard them?')) return
    setDate(newDate)
    setRows(rowsForDate(sets ?? [], newDate))
    setDirty(false)
    setMessage(null)
  }

  function updateRow(index: number, field: 'weight' | 'reps', value: string) {
    setRows((old) => updateRows(old, index, field, value))
    setDirty(true)
    setMessage(null)
  }

  // Tapping into a row with an empty weight copies the weight of the set above (gray).
  // Returns the updated rows. Doesn't count as an unsaved change: gray weights without
  // reps are skipped on save anyway.
  function prefill(index: number): RowInput[] {
    const next = prefillRow(rows, index)
    if (next !== rows) setRows(next)
    return next
  }

  // The − / + buttons next to the weight field.
  // On an empty row they start from the weight of the set above.
  function stepWeight(index: number, delta: number) {
    const current = parseWeight(prefillRow(rows, index)[index].weight) ?? 0
    updateRow(index, 'weight', formatWeight(Math.max(0, current + delta)))
  }

  async function save(e: FormEvent) {
    e.preventDefault()

    // Check the rows; empty rows and rows with only a prefilled weight are skipped
    const toSave = []
    for (let i = 0; i < MAX_SETS; i++) {
      if (isSkipped(rows[i])) continue
      const { weight, reps } = rows[i]
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

    // Did this day beat the personal bests of all other days?
    const otherDays = (sets ?? []).filter((s) => s.date !== date)
    const newRecords: string[] = []
    const oldHeaviest = bestByWeight(otherDays)
    const heaviestToday = bestByWeight(toSave)
    if (oldHeaviest && heaviestToday && heaviestToday.weight_kg > oldHeaviest.weight_kg) {
      newRecords.push(`heaviest ${describeSet(heaviestToday)}`)
    }
    const oldMostVolume = bestByVolume(otherDays)
    const mostVolumeToday = bestByVolume(toSave)
    if (oldMostVolume && mostVolumeToday && volume(mostVolumeToday) > volume(oldMostVolume)) {
      newRecords.push(`best volume ${formatVolume(volume(mostVolumeToday))}`)
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
      setMessage({
        kind: 'ok',
        text:
          newRecords.length > 0
            ? `Saved ✓ New personal best: ${newRecords.join(' and ')} 🎉`
            : 'Saved ✓',
      })
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
        <div className="topbar-actions">
          {isCustom && (
            <button className="link-button" onClick={() => setEditing(!editing)}>
              {editing ? 'Close' : 'Edit'}
            </button>
          )}
          <Link className="pill-link" to={`/exercise/${id}/history`}>
            History
          </Link>
        </div>
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

      <PersonalBests sets={sets} />

      <Calendar selected={date} onSelect={selectDate} markedDates={loggedDates} />

      <h2 className="day-title">{formatDay(date)}</h2>

      {lastSession && (
        <p className="last-time">
          <span className="muted">Last time ({formatDay(lastSession.date)}):</span>{' '}
          {lastSession.sets.map((s) => `${formatWeight(s.weight_kg)} × ${s.reps}`).join(' · ')}
        </p>
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
                  className={isPrefilled(row) ? 'prefilled' : undefined}
                  value={row.weight}
                  onChange={(e) => updateRow(i, 'weight', e.target.value)}
                  onFocus={(e) => {
                    // Prefill from the set above, and select a prefilled weight so
                    // typing replaces it. (Delayed, because iPhone Safari would undo
                    // an immediate selection.)
                    if (!isPrefilled(prefill(i)[i])) return
                    const input = e.currentTarget
                    setTimeout(() => input.setSelectionRange(0, input.value.length), 0)
                  }}
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
                onFocus={() => prefill(i)}
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
