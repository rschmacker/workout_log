import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import BackLink from '../components/BackLink'
import { formatDay } from '../dates'
import { categoryFromSlug, categoryLabel, categorySlug, useExercises } from '../exercises'
import { useMySets } from '../sets'

// The exercises of one body part, with the date each was last logged
export default function ExerciseList() {
  const { category: slug } = useParams()
  const category = categoryFromSlug(slug)
  const { data: allExercises, error } = useExercises()
  const { data: sets } = useMySets()

  // Last logged date per exercise (your sets are sorted by date, so the last one wins)
  const lastDates = useMemo(() => {
    const dates = new Map<string, string>()
    for (const s of sets ?? []) dates.set(s.exercise_id, s.date)
    return dates
  }, [sets])

  if (!category) {
    return (
      <main className="page">
        <BackLink parent="/" />
        <p className="error">Unknown body part.</p>
      </main>
    )
  }

  const exercises = allExercises?.filter((e) => e.category === category)

  return (
    <main className="page">
      <BackLink parent="/" />
      <h1>{categoryLabel(category)}</h1>

      {!exercises && error && <p className="error">Could not load exercises: {error}</p>}
      {!exercises && !error && <p className="muted">Loading…</p>}

      {exercises && (
        <div className="exercise-list">
          {exercises.map((exercise) => {
            const last = lastDates.get(exercise.id)
            return (
              <Link key={exercise.id} className="card exercise-item" to={`/exercise/${exercise.id}`}>
                {exercise.name}
                {/* Empty while loading; the CSS keeps its height so the list doesn't jump */}
                <span className="exercise-last">
                  {!sets ? '' : last ? `Last: ${formatDay(last)}` : 'Not logged yet'}
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
