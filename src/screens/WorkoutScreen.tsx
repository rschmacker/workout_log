import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import BackLink from '../components/BackLink'
import PlainList from '../components/PlainList'
import { formatDay, todayISO } from '../dates'
import { formatDateTime, nameOf, useProfiles } from '../profiles'
import { useMySets } from '../sets'
import { useUserId } from '../useUserId'
import {
  blockHeading,
  prescription,
  useWorkouts,
  workoutTypeOf,
  type MainExercise,
  type Workout,
} from '../workouts'

// One main exercise as a card: tap to log it. Marked done once it has sets today.
function ExerciseCard({ workout, item, done }: { workout: Workout; item: MainExercise; done: boolean }) {
  return (
    <Link
      className={`card exercise-item${done ? ' done' : ''}`}
      to={`/exercise/${item.exerciseId}?workout=${workout.id}&item=${item.index}`}
    >
      <span className="workout-exercise-name">
        {item.exercise}
        {done && <span className="done-badge">✓ Done</span>}
      </span>
      {item.note && <span className="note-text">{item.note}</span>}
      <span className="exercise-last">{prescription(item)}</span>
    </Link>
  )
}

// One saved workout: warmup and finisher (plain lists), main exercises and supersets
// (tap to log). A main exercise is marked done once it has sets logged today.
export default function WorkoutScreen() {
  const { id = '' } = useParams()
  const today = todayISO()
  const { data: workouts, refreshing, error } = useWorkouts()
  const profiles = useProfiles() // without names it shows "by someone"
  const { data: sets } = useMySets()
  const myUserId = useUserId()
  const workout = workouts?.find((w) => w.id === id)

  // Exercises with sets logged today
  const doneIds = useMemo(
    () => new Set((sets ?? []).filter((s) => s.date === today).map((s) => s.exercise_id)),
    [sets, today],
  )

  if (!workouts && error) {
    return (
      <main className="page">
        <BackLink parent="/" />
        <p className="error">Could not load the workout: {error}</p>
      </main>
    )
  }

  // Not on this phone yet (e.g. just created by a friend): wait for Supabase's answer
  if (!workout && (!workouts || refreshing)) {
    return (
      <main className="page">
        <p className="muted">Loading…</p>
      </main>
    )
  }

  if (!workout) {
    return (
      <main className="page">
        <BackLink parent="/" />
        <p className="error">This workout doesn't exist (anymore).</p>
      </main>
    )
  }

  const type = workoutTypeOf(workout)
  const doneCount = workout.exercises.filter((e) => doneIds.has(e.exerciseId)).length

  return (
    <main className="page">
      <BackLink parent={`/workouts/${type.slug}`} />
      <header className="topbar">
        <h1>{workout.name}</h1>
        <div className="topbar-actions">
          {/* Everyone can edit; built-in workouts can only be duplicated */}
          <Link
            className="pill-link"
            to={`/workout/${workout.id}/${workout.userId === null ? 'duplicate' : 'edit'}`}
          >
            {workout.userId === null ? 'Duplicate' : 'Edit'}
          </Link>
        </div>
      </header>
      <p className="muted workout-subtitle">
        {type.label} · {formatDay(today)}
      </p>
      <p className="muted workout-subtitle small">
        by {nameOf(profiles, workout.userId, myUserId)}
        {workout.updatedBy &&
          ` · last edited by ${nameOf(profiles, workout.updatedBy, myUserId)}, ${formatDateTime(workout.updatedAt)}`}
      </p>

      {workout.warmup.length > 0 && (
        <section className="section">
          <h2>Warmup</h2>
          <PlainList lines={workout.warmup} />
        </section>
      )}

      <section className="section">
        <h2>
          Workout · {doneCount} of {workout.exercises.length} done
        </h2>
        {workout.blocks.map((block, b) => {
          const superset = block.exercises.length > 1
          const rounds = Math.max(...block.exercises.map((e) => e.sets))
          const heading = blockHeading(block)
          return (
            <div key={b} className={`block${superset ? ' superset' : ''}`}>
              {(superset || heading) && (
                <p className="block-heading">
                  {superset && <span className="superset-label">Superset · {rounds} rounds</span>}
                  {heading}
                </p>
              )}
              {block.cues.length > 0 && <p className="block-cues">{block.cues.join(' · ')}</p>}
              <div className="block-exercises">
                {block.exercises.map((item) => (
                  <ExerciseCard
                    key={item.index}
                    workout={workout}
                    item={item}
                    done={doneIds.has(item.exerciseId)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </section>

      {workout.finisher.length > 0 && (
        <section className="section">
          <h2>Finisher</h2>
          <PlainList lines={workout.finisher} />
        </section>
      )}
    </main>
  )
}
