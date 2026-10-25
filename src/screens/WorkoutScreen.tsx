import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import BackLink from '../components/BackLink'
import PlainList from '../components/PlainList'
import { formatDay, todayISO } from '../dates'
import { fetchProfiles, formatDateTime, nameOf } from '../profiles'
import { supabase } from '../supabase'
import { useUserId } from '../useUserId'
import {
  blockHeading,
  fetchWorkout,
  prescription,
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
  // undefined = loading, null = doesn't exist
  const [workout, setWorkout] = useState<Workout | null | undefined>(undefined)
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())
  const [profiles, setProfiles] = useState<Map<string, string> | null>(null)
  const myUserId = useUserId()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProfiles()
      .then(setProfiles)
      .catch(() => {}) // without names it shows "by someone"
    fetchWorkout(id)
      .then(async (loaded) => {
        setWorkout(loaded)
        if (!loaded) return
        // Which of its exercises have sets logged today (only your own sets are visible)
        const { data, error } = await supabase
          .from('workout_sets')
          .select('exercise_id')
          .eq('date', today)
          .in('exercise_id', loaded.exercises.map((e) => e.exerciseId))
        if (error) throw error
        setDoneIds(new Set(data.map((row) => row.exercise_id as string)))
      })
      .catch((e: Error) => setError(e.message))
  }, [id, today])

  if (error) {
    return (
      <main className="page">
        <BackLink parent="/" />
        <p className="error">Could not load the workout: {error}</p>
      </main>
    )
  }

  if (workout === undefined) {
    return (
      <main className="page">
        <p className="muted">Loading…</p>
      </main>
    )
  }

  if (workout === null) {
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
