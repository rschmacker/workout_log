import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { CATEGORIES, type Exercise } from '../exercises'
import { supabase } from '../supabase'

export default function Home() {
  const [exercises, setExercises] = useState<Exercise[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Row Level Security only returns the built-in exercises plus your own
    supabase
      .from('exercises')
      .select('id, user_id, name, category')
      .order('name')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setExercises(data as Exercise[])
      })
  }, [])

  return (
    <main className="page">
      <header className="topbar">
        <h1>Workouts</h1>
        <button className="link-button" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </header>

      {error && <p className="error">Could not load exercises: {error}</p>}
      {!exercises && !error && <p className="muted">Loading…</p>}

      {exercises &&
        CATEGORIES.map((category) => {
          const inCategory = exercises.filter((e) => e.category === category)
          if (inCategory.length === 0) return null
          return (
            <section key={category} className="section">
              <h2>{category}</h2>
              <div className="card-grid">
                {inCategory.map((exercise) => (
                  <Link key={exercise.id} className="card" to={`/exercise/${exercise.id}`}>
                    {exercise.name}
                  </Link>
                ))}
              </div>
            </section>
          )
        })}

      {exercises && (
        <Link className="card card-add" to="/add-exercise">
          + Add custom exercise
        </Link>
      )}
    </main>
  )
}
