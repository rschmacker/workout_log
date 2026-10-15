import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { CATEGORIES, type Category } from '../exercises'
import { supabase } from '../supabase'

export default function AddExercise() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [category, setCategory] = useState<Category | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!category) {
      setError('Please pick a category.')
      return
    }
    setBusy(true)
    setError(null)
    // user_id is filled in by the database (default auth.uid())
    const { error } = await supabase
      .from('exercises')
      .insert({ name: name.trim(), category })
    if (error) {
      // 23505 = unique constraint: you already have an exercise with this name
      setError(
        error.code === '23505'
          ? 'You already have an exercise with this name.'
          : error.message,
      )
      setBusy(false)
      return
    }
    navigate('/')
  }

  return (
    <main className="page">
      <Link className="back-link" to="/">
        ‹ Back
      </Link>
      <h1>Add exercise</h1>

      <form className="stack" onSubmit={save}>
        <label className="field">
          Name
          <input
            type="text"
            autoCapitalize="words"
            maxLength={60}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <fieldset className="field">
          <legend>Category</legend>
          <div className="choice-grid">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                className="choice"
                aria-pressed={category === c}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </fieldset>

        <button className="button" disabled={busy || name.trim() === ''}>
          Save exercise
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </main>
  )
}
