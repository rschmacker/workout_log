import { useParams } from 'react-router'
import BackLink from '../components/BackLink'
import { WORKOUT_TYPES } from '../workouts'

// The saved workouts of one type (upper / lower / full body).
// Placeholder until saved workouts are built (TODO item 4).
export default function WorkoutList() {
  const { type: slug } = useParams()
  const type = WORKOUT_TYPES.find((t) => t.slug === slug)

  return (
    <main className="page">
      <BackLink parent="/" />
      {type ? (
        <>
          <h1>{type.label}</h1>
          <p className="muted">No saved workouts yet. They come in a later step.</p>
        </>
      ) : (
        <p className="error">Unknown workout type.</p>
      )}
    </main>
  )
}
