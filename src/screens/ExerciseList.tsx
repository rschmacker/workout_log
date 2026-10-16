import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import BackLink from '../components/BackLink'
import { formatDay } from '../dates'
import { categoryFromSlug, categoryLabel, categorySlug, type Exercise } from '../exercises'
import { supabase } from '../supabase'

// The exercises of one body part, with the date each was last logged
export default function ExerciseList() {
  const { category: slug } = useParams()
  const category = categoryFromSlug(slug)
  const [exercises, setExercises] = useState<Exercise[] | null>(null)
  const [lastDates, setLastDates] = useState<Record<string, string | null>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!category) return
    // Row Level Security only returns the built-in exercises plus your own
    supabase
      .from('exercises')
      .select('id, user_id, name, category')
      .eq('category', category)
      .order('name')
      .then(async ({ data, error }) => {
        if (error) {
          setError(error.message)
          return
        }
        const list = data as Exercise[]
        setExercises(list)
        // Last logged date per exercise: one small request each (a body part has only a few)
        const results = await Promise.all(
          list.map((e) =>
            supabase
              .from('workout_sets')
              .select('date')
              .eq('exercise_id', e.id)
              .order('date', { ascending: false })
              .limit(1)
              .maybeSingle(),
          ),
        )
        setLastDates(
          Object.fromEntries(list.map((e, i) => [e.id, results[i].data?.date ?? null])),
        )
      })
  }, [category])

  if (!category) {
    return (
      <main className="page">
        <BackLink parent="/" />
        <p className="error">Unknown body part.</p>
      </main>
    )
  }

  return (
    <main className="page">
      <BackLink parent="/" />
      <h1>{categoryLabel(category)}</h1>

      {error && <p className="error">Could not load exercises: {error}</p>}
      {!exercises && !error && <p className="muted">Loading…</p>}

      {exercises && (
        <div className="exercise-list">
          {exercises.map((exercise) => {
            const last = lastDates[exercise.id]
            return (
              <Link key={exercise.id} className="card exercise-item" to={`/exercise/${exercise.id}`}>
                {exercise.name}
                {/* Empty while loading; the CSS keeps its height so the list doesn't jump */}
                <span className="exercise-last">
                  {last === undefined ? '' : last ? `Last: ${formatDay(last)}` : 'Not logged yet'}
                </span>
              </Link>
            )
          })}
          <Link
            className="card card-add"
            to={`/add-exercise?category=${categorySlug(category)}`}
          >
            + Add custom exercise
          </Link>
        </div>
      )}
    </main>
  )
}
