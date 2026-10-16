import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import BackLink from '../components/BackLink'
import PlainList from '../components/PlainList'
import { formatDay, todayISO } from '../dates'
import type { Exercise } from '../exercises'
import { supabase } from '../supabase'
import type { MainExercise, Workout } from '../workoutFormat'
import { workoutExercises } from '../workoutExercises'
import { blockHeading, findWorkout, prescription, workoutTypeOf } from '../workouts'

// One main exercise as a card: tap to log it. Marked done once it has sets today.
function ExerciseCard({
  workout,
  item,
  exercise,
  done,
}: {
  workout: Workout
  item: MainExercise
  exercise: Exercise | undefined
  done: boolean
}) {
  const content = (
    <>
      <span className="workout-exercise-name">
        {item.exercise}
        {done && <span className="done-badge">✓ Done</span>}
      </span>
      {item.note && <span className="note-text">{item.note}</span>}
      <span className="exercise-last">{prescription(item)}</span>
    </>
  )
  // Until the exercises are loaded (or if one is missing), the card isn't tappable
  if (!exercise) return <div className="card exercise-item disabled">{content}</div>
  return (
    <Link
      className={`card exercise-item${done ? ' done' : ''}`}
      to={`/exercise/${exercise.id}?workout=${workout.slug}&item=${item.index}`}
    >
      {content}
    </Link>
  )
}

// One saved workout: warmup and finisher (plain lists), main exercises and supersets
// (tap to log). A main exercise is marked done once it has sets logged today.
export default function WorkoutScreen() {
  const { slug } = useParams()
  const workout = findWorkout(slug)
  const today = todayISO()
  const [exercises, setExercises] = useState<Map<string, Exercise> | null>(null)
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!workout) return
    workoutExercises()
      .then(async (byName) => {
        setExercises(byName)
        const ids = workout.exercises.flatMap((m) => byName.get(m.exercise.toLowerCase())?.id ?? [])
        const { data, error } = await supabase
          .from('workout_sets')
          .select('exercise_id')
          .eq('date', today)
          .in('exercise_id', ids)
        if (error) throw error
        setDoneIds(new Set(data.map((row) => row.exercise_id as string)))
      })
      .catch((e: Error) => setError(e.message))
  }, [workout, today])

  if (!workout) {
    return (
      <main className="page">
        <BackLink parent="/" />
        <p className="error">This workout doesn't exist (anymore).</p>
      </main>
    )
  }

  const type = workoutTypeOf(workout)
  const exerciseOf = (item: MainExercise) => exercises?.get(item.exercise.toLowerCase())
  const isDone = (item: MainExercise) => doneIds.has(exerciseOf(item)?.id ?? '')
  const doneCount = workout.exercises.filter(isDone).length

  return (
    <main className="page">
      <BackLink parent={`/workouts/${type.slug}`} />
      <h1>{workout.name}</h1>
      <p className="muted workout-subtitle">
        {type.label} · {formatDay(today)}
      </p>

      {error && <p className="error">Could not load the exercises: {error}</p>}

      {workout.warmup.length > 0 && (
        <section className="section">
          <h2>Warmup</h2>
          <PlainList lines={workout.warmup} />
        </section>
      )}

      <section className="section">
        <h2>
          Workout
          {exercises && ` · ${doneCount} of ${workout.exercises.length} done`}
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
                    exercise={exerciseOf(item)}
                    done={isDone(item)}
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
