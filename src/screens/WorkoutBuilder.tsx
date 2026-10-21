import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router'
import BackLink from '../components/BackLink'
import ExercisePicker from '../components/ExercisePicker'
import NoteField from '../components/NoteField'
import { fetchEntries, type ExerciseEntry } from '../entries'
import { useGoBack } from '../useGoBack'
import {
  LIMITS,
  autoName,
  draftFromWorkout,
  emptyDraft,
  groupsOf,
  newKey,
  startsGroup,
  validateDraft,
  type Draft,
  type DraftExercise,
} from '../workoutDraft'
import { WORKOUT_TYPES, fetchWorkout, saveWorkout, type Workout } from '../workouts'

type Mode = 'create' | 'edit' | 'duplicate'

// One main exercise in the builder: sets, hints, Besonderheit, superset switch,
// and (for a single exercise or the first of a superset) title, time and cues
function BuilderExercise({
  item,
  number,
  isFirst,
  isLast,
  groupStart,
  entries,
  onChange,
  onMove,
  onRemove,
}: {
  item: DraftExercise
  number: number
  isFirst: boolean
  isLast: boolean
  groupStart: boolean
  entries: ExerciseEntry[]
  onChange: (patch: Partial<DraftExercise>) => void
  onMove: (delta: number) => void
  onRemove: () => void
}) {
  const hasDetails = item.title !== '' || item.time !== '' || item.cues !== ''
  return (
    <div className="panel builder-exercise">
      <div className="builder-exercise-head">
        <strong>
          {number}. {item.exercise}
        </strong>
        <div className="icon-buttons">
          <button type="button" aria-label="Move up" disabled={isFirst} onClick={() => onMove(-1)}>
            ↑
          </button>
          <button type="button" aria-label="Move down" disabled={isLast} onClick={() => onMove(1)}>
            ↓
          </button>
          <button type="button" aria-label={`Remove ${item.exercise}`} onClick={onRemove}>
            ✕
          </button>
        </div>
      </div>

      <div className="field">
        Sets
        <div className="choice-grid sets-choice">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className="choice"
              aria-pressed={item.sets === n}
              onClick={() => onChange({ sets: n })}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="two-columns">
        <label className="field">
          Reps (hint)
          <input
            type="text"
            maxLength={LIMITS.hint}
            placeholder="e.g. 8-10"
            value={item.reps}
            onChange={(e) => onChange({ reps: e.target.value })}
          />
        </label>
        <label className="field">
          Weight (hint)
          <input
            type="text"
            maxLength={LIMITS.hint}
            placeholder="e.g. RPE 8"
            value={item.weight}
            onChange={(e) => onChange({ weight: e.target.value })}
          />
        </label>
      </div>

      <NoteField
        value={item.note}
        onChange={(note) => onChange({ note })}
        entries={entries}
        exerciseId={item.exerciseId}
      />

      {groupStart && (
        <details className="builder-details" open={hasDetails}>
          <summary>Title, time and cues</summary>
          <div className="stack">
            <label className="field">
              Title
              <input
                type="text"
                maxLength={LIMITS.title}
                placeholder="e.g. Chest & Lat Pump"
                value={item.title}
                onChange={(e) => onChange({ title: e.target.value })}
              />
            </label>
            <label className="field">
              Time
              <input
                type="text"
                maxLength={LIMITS.time}
                placeholder="e.g. 18 min"
                value={item.time}
                onChange={(e) => onChange({ time: e.target.value })}
              />
            </label>
            <label className="field">
              Cues (one per line)
              <textarea
                rows={3}
                maxLength={LIMITS.cues}
                placeholder={'RIR 1-2\n3 sec eccentric\n>2 min rest'}
                value={item.cues}
                onChange={(e) => onChange({ cues: e.target.value })}
              />
            </label>
          </div>
        </details>
      )}

      {!isLast && (
        <label className="switch-row">
          <input
            type="checkbox"
            checked={item.supersetWithNext}
            onChange={(e) => onChange({ supersetWithNext: e.target.checked })}
          />
          Superset with next exercise
        </label>
      )}
    </div>
  )
}

// Create, edit or duplicate a saved workout
export default function WorkoutBuilder({ mode }: { mode: Mode }) {
  const { id = '', type: typeSlug } = useParams()
  const navigate = useNavigate()
  const goBack = useGoBack()

  // A new workout starts empty, of the type it was created from
  const [initial] = useState(() => {
    if (mode !== 'create') return null
    const type = WORKOUT_TYPES.find((t) => t.slug === typeSlug)
    return emptyDraft(type?.category ?? 'full body')
  })
  const [draft, setDraft] = useState<Draft | null>(initial)
  const [savedJson, setSavedJson] = useState(() => (initial ? JSON.stringify(initial) : ''))
  const [source, setSource] = useState<Workout | null>(null) // the workout being edited/copied
  const [entries, setEntries] = useState<ExerciseEntry[]>([]) // your notes, for suggestions
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const scrollBeforePicking = useRef(0)
  const leaving = useRef(false) // set right before leaving after a successful save

  const dirty = draft !== null && JSON.stringify(draft) !== savedJson

  useEffect(() => {
    fetchEntries()
      .then(setEntries)
      .catch(() => {}) // only used for suggestions
    if (mode === 'create') return
    fetchWorkout(id)
      .then((workout) => {
        if (!workout) {
          setLoadError("This workout doesn't exist (anymore).")
          return
        }
        const loaded = draftFromWorkout(workout)
        if (mode === 'duplicate') loaded.name = `${workout.name} (copy)`
        setSource(workout)
        setDraft(loaded)
        setSavedJson(JSON.stringify(loaded))
      })
      .catch((e: Error) => setLoadError(e.message))
  }, [mode, id])

  // Warn before leaving with unsaved changes (Back, Cancel, the phone's back gesture …)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !leaving.current && dirty && currentLocation.pathname !== nextLocation.pathname,
  )
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm('Discard your changes to this workout?')) blocker.proceed()
    else blocker.reset()
  }, [blocker])

  // … and before closing or reloading the page
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const parent =
    mode === 'create' ? `/workouts/${typeSlug}` : `/workout/${id}`

  if (loadError) {
    return (
      <main className="page">
        <BackLink parent={parent} />
        <p className="error">{loadError}</p>
      </main>
    )
  }

  if (!draft) {
    return (
      <main className="page">
        <p className="muted">Loading…</p>
      </main>
    )
  }

  const update = (patch: Partial<Draft>) => {
    setDraft({ ...draft, ...patch })
    setError(null)
  }
  const updateExercise = (key: string, patch: Partial<DraftExercise>) =>
    update({ exercises: draft.exercises.map((e) => (e.key === key ? { ...e, ...patch } : e)) })

  function move(index: number, delta: number) {
    const list = [...draft!.exercises]
    const [item] = list.splice(index, 1)
    list.splice(index + delta, 0, item)
    update({ exercises: list })
  }

  function remove(index: number) {
    update({ exercises: draft!.exercises.filter((_, i) => i !== index) })
  }

  function openPicker() {
    scrollBeforePicking.current = window.scrollY
    setPicking(true)
    window.scrollTo(0, 0)
  }

  function closePicker() {
    setPicking(false)
    requestAnimationFrame(() => window.scrollTo(0, scrollBeforePicking.current))
  }

  async function save(e?: FormEvent, overwrite = false) {
    e?.preventDefault()
    const problem = validateDraft(draft!)
    if (problem) {
      setError(problem)
      return
    }
    setBusy(true)
    setError(null)
    setConflict(false)
    try {
      const editing = mode === 'edit' && source
      const savedId = await saveWorkout(
        editing ? source.id : null,
        draft!,
        editing && !overwrite ? source.updatedAt : null,
      )
      leaving.current = true
      // Edit: back to where you came from. New/copy: show the new workout instead of the builder
      if (mode === 'edit') goBack(`/workout/${savedId}`)
      else navigate(`/workout/${savedId}`, { replace: true })
    } catch (err) {
      const message = (err as Error).message
      if (message.startsWith('WORKOUT_CHANGED')) setConflict(true)
      else setError(message)
      setBusy(false)
    }
  }

  // Someone else saved meanwhile: show their version (your changes are dropped)
  async function loadTheirVersion() {
    if (!window.confirm('Load their version? Your changes will be lost.')) return
    const workout = await fetchWorkout(id)
    if (!workout) {
      setLoadError("This workout doesn't exist anymore (maybe it was deleted).")
      return
    }
    const loaded = draftFromWorkout(workout)
    setSource(workout)
    setDraft(loaded)
    setSavedJson(JSON.stringify(loaded))
    setConflict(false)
  }

  if (picking) {
    return (
      <main className="page">
        <ExercisePicker
          alreadyUsed={new Set(draft.exercises.map((e) => e.exerciseId))}
          onCancel={closePicker}
          onPick={(exercise) => {
            update({
              exercises: [
                ...draft.exercises,
                {
                  key: newKey(),
                  exerciseId: exercise.id,
                  exercise: exercise.name,
                  category: exercise.category,
                  sets: 3,
                  reps: '',
                  weight: '',
                  note: '',
                  supersetWithNext: false,
                  title: '',
                  time: '',
                  cues: '',
                },
              ],
            })
            setPicking(false)
            // Show the newly added exercise at the bottom of the list
            requestAnimationFrame(() =>
              document.getElementById('add-exercise')?.scrollIntoView({ block: 'center' }),
            )
          }}
        />
      </main>
    )
  }

  const heading = { create: 'New workout', edit: 'Edit workout', duplicate: 'Copy of a workout' }[mode]
  const index = new Map(draft.exercises.map((e, i) => [e.key, i]))

  return (
    <main className="page">
      <BackLink parent={parent} />
      <h1>{heading}</h1>
      {mode === 'duplicate' && source && (
        <p className="muted">
          A copy of "{source.name}" as your own workout. The original stays unchanged.
        </p>
      )}

      <form onSubmit={save}>
        <div className="stack">
          <label className="field">
            Name (optional)
            <input
              type="text"
              maxLength={LIMITS.name}
              placeholder={autoName(draft) || 'Named after the main exercises'}
              value={draft.name}
              onChange={(e) => update({ name: e.target.value })}
            />
          </label>

          <fieldset className="field">
            <legend>Type</legend>
            <div className="choice-grid">
              {WORKOUT_TYPES.map((t) => (
                <button
                  key={t.slug}
                  type="button"
                  className="choice"
                  aria-pressed={draft.category === t.category}
                  onClick={() => update({ category: t.category })}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <section className="section">
          <h2>Warmup</h2>
          <textarea
            rows={5}
            maxLength={LIMITS.warmup}
            aria-label="Warmup"
            placeholder={'2 Rounds:\n- 10 Ring Rows\n- 10 Push Ups'}
            value={draft.warmup}
            onChange={(e) => update({ warmup: e.target.value })}
          />
          <p className="muted hint">One line per item. Start a line with "- " for a bullet point.</p>
        </section>

        <section className="section">
          <h2>Main exercises</h2>
          {draft.exercises.length === 0 && (
            <p className="muted">No exercises yet. Add at least one.</p>
          )}
          {groupsOf(draft.exercises).map((group) => (
            <div
              key={group[0].key}
              className={`builder-group${group.length > 1 ? ' superset' : ''}`}
            >
              {group.length > 1 && (
                <p className="block-heading">
                  <span className="superset-label">Superset</span>
                </p>
              )}
              <div className="block-exercises">
                {group.map((item) => {
                  const i = index.get(item.key)!
                  return (
                    <BuilderExercise
                      key={item.key}
                      item={item}
                      number={i + 1}
                      isFirst={i === 0}
                      isLast={i === draft.exercises.length - 1}
                      groupStart={startsGroup(draft.exercises, i)}
                      entries={entries}
                      onChange={(patch) => updateExercise(item.key, patch)}
                      onMove={(delta) => move(i, delta)}
                      onRemove={() => remove(i)}
                    />
                  )
                })}
              </div>
            </div>
          ))}
          <button
            id="add-exercise"
            type="button"
            className="card card-add"
            onClick={openPicker}
          >
            + Add exercise
          </button>
        </section>

        <section className="section">
          <h2>Finisher</h2>
          <textarea
            rows={4}
            maxLength={LIMITS.finisher}
            aria-label="Finisher"
            placeholder={'Glute & Quad Pump: 4 Rounds\n- 40 sec Goblet Squats\n- 40 sec Plank'}
            value={draft.finisher}
            onChange={(e) => update({ finisher: e.target.value })}
          />
          <p className="muted hint">Shown like the warmup; nothing is logged.</p>
        </section>

        <div className="stack">
          {conflict && (
            <div className="panel conflict">
              <p>
                <strong>Someone else saved this workout after you opened it.</strong> Your changes
                are not saved yet.
              </p>
              <button type="button" className="button secondary" onClick={loadTheirVersion}>
                Load their version
              </button>
              <button
                type="button"
                className="button danger"
                disabled={busy}
                onClick={() => save(undefined, true)}
              >
                Save mine anyway (replaces theirs)
              </button>
            </div>
          )}
          {error && <p className="error">{error}</p>}
          <button className="button" disabled={busy}>
            {mode === 'edit' ? 'Save changes' : 'Save workout'}
          </button>
          <button type="button" className="button secondary" onClick={() => goBack(parent)}>
            Cancel
          </button>
        </div>
      </form>
    </main>
  )
}
