import { Link, useParams } from 'react-router'
import BackLink from '../components/BackLink'
import type { Workout } from '../workoutFormat'
import { WORKOUT_TYPES, WORKOUTS } from '../workouts'

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

  if (!type) {
    return (
      <main className="page">
        <BackLink parent="/" />
        <p className="error">Unknown workout type.</p>
      </main>
    )
  }

  const workouts = WORKOUTS.filter((w) => w.category === type.category)

  return (
    <main className="page">
      <BackLink parent="/" />
      <h1>{type.label}</h1>

      {workouts.length === 0 && (
        <p className="muted">No {type.label.toLowerCase()} workouts yet.</p>
      )}

      <div className="exercise-list">
        {workouts.map((workout) => (
          <Link key={workout.slug} className="card exercise-item" to={`/workout/${workout.slug}`}>
            {workout.name}
            <span className="exercise-last">{workoutSummary(workout)}</span>
          </Link>
        ))}
      </div>
    </main>
  )
}
