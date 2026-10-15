import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { supabase } from '../supabase'

// Placeholder for step 4 (calendar and set entry).
export default function ExerciseScreen() {
  const { id } = useParams()
  const [name, setName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('exercises')
      .select('name')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setName(data.name)
      })
  }, [id])

  return (
    <main className="page">
      <Link className="back-link" to="/">
        ‹ Back
      </Link>
      {error && <p className="error">Could not load exercise: {error}</p>}
      {name && <h1>{name}</h1>}
      <p className="muted">Calendar and set entry come in step 4.</p>
    </main>
  )
}
