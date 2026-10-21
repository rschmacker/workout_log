import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import BackLink from '../components/BackLink'
import { useGoBack } from '../useGoBack'
import {
  CATEGORIES,
  categoryFromSlug,
  categoryLabel,
  categorySlug,
  type Category,
} from '../exercises'
import { supabase } from '../supabase'

export default function AddExercise() {
  const navigate = useNavigate()
  const goBack = useGoBack()
  const [searchParams] = useSearchParams()
  // Opened from a body part's list: that body part is preselected
  const [startCategory] = useState(() => categoryFromSlug(searchParams.get('category') ?? ''))
  const parent = startCategory ? `/exercises/${categorySlug(startCategory)}` : '/'

  const [name, setName] = useState('')
  const [category, setCategory] = useState<Category | null>(startCategory)
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
      // 23505 = unique constraint: an exercise with this name already exists (also a friend's)
      setError(
        error.code === '23505'
          ? 'An exercise with this name already exists (exercises are shared, so maybe a friend created it).'
          : error.message,
      )
      setBusy(false)
      return
    }
    // Back to the list it was added from; if you picked another body part, show that list
    if (category === startCategory) goBack(parent)
    else navigate(`/exercises/${categorySlug(category)}`, { replace: true })
  }

  return (
    <main className="page">
      <BackLink parent={parent} />
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
                {categoryLabel(c)}
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
