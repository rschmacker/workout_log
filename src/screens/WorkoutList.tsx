import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import BackLink from '../components/BackLink'
import { useUserId } from '../useUserId'
import { WORKOUT_TYPES, deleteWorkout, fetchWorkouts, type Workout } from '../workouts'

// "4 exercises · 2 supersets · warmup · finisher"
function workoutSummary(workout: Workout): string {
  const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
  const supersets = workout.blocks.filter((b) => b.exercises.length > 1).length
  return [
    count(workout.exercises.length, 'exercise'),
    supersets > 0 && count(supersets, 'superset'),
    workout.warmup.length > 0 && 'warmup',
    workout.finisher.length > 0 && 'finisher',
  ]
    .filter(Boolean)
    .join(' · ')
}

// The saved workouts of one type (upper / lower / full body)
export default function WorkoutList() {
  const { type: slug } = useParams()
  const type = WORKOUT_TYPES.find((t) => t.slug === slug)
  const myUserId = useUserId()
  const [workouts, setWorkouts] = useState<Workout[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [menuFor, setMenuFor] = useState<string | null>(null) // workout whose ⋯ menu is open

  useEffect(() => {
    if (!type) return
    fetchWorkouts(type.category)
      .then(setWorkouts)
      .catch((e: Error) => setError(e.message))
  }, [type])

  async function remove(workout: Workout) {
    const ok = window.confirm(
      `Delete "${workout.name}" for everyone? Sets already logged with it stay in everyone's history.`,
    )
    if (!ok) return
    try {
      await deleteWorkout(workout.id)
      setWorkouts((list) => list?.filter((w) => w.id !== workout.id) ?? null)
      setMenuFor(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  if (!type) {
    return (
      <main className="page">
        <BackLink parent="/" />
        <p className="error">Unknown workout type.</p>
      </main>
    )
  }

  return (
    <main className="page">
      <BackLink parent="/" />
      <h1>{type.label}</h1>

      <div className="exercise-list">
        <Link className="card card-add" to={`/workouts/${type.slug}/new`}>
          + Create workout
        </Link>

        {error && <p className="error">{error}</p>}
        {!workouts && !error && <p className="muted">Loading…</p>}
        {workouts?.length === 0 && (
          <p className="muted">No {type.label.toLowerCase()} workouts yet.</p>
        )}

        {workouts?.map((workout) => {
          const builtIn = workout.userId === null
          const mine = workout.userId !== null && workout.userId === myUserId
          const menuOpen = menuFor === workout.id
          return (
            <div key={workout.id}>
              <div className="card-with-menu">
                <Link className="card exercise-item" to={`/workout/${workout.id}`}>
                  {workout.name}
                  <span className="exercise-last">{workoutSummary(workout)}</span>
                </Link>
                <button
                  type="button"
                  className="menu-button"
                  aria-label={`More for ${workout.name}`}
                  aria-expanded={menuOpen}
                  onClick={() => setMenuFor(menuOpen ? null : workout.id)}
                >
                  ⋯
                </button>
              </div>
              {menuOpen && (
                <div className="card-menu">
                  {!builtIn && (
                    <Link className="button secondary" to={`/workout/${workout.id}/edit`}>
                      Edit
                    </Link>
                  )}
                  <Link className="button secondary" to={`/workout/${workout.id}/duplicate`}>
                    Duplicate
                  </Link>
                  {mine && (
                    <button type="button" className="button danger" onClick={() => remove(workout)}>
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}
