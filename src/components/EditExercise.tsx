import { useState, type FormEvent } from 'react'
import type { Exercise } from '../exercises'
import { supabase } from '../supabase'

type Props = {
  exercise: Exercise
  onRenamed: (name: string) => void
  onDeleted: () => void
}

// Rename or delete a custom exercise. Only shown for your own exercises,
// built-in ones can't be changed (Row Level Security would block it anyway).
export default function EditExercise({ exercise, onRenamed, onDeleted }: Props) {
  const [name, setName] = useState(exercise.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function rename(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase
      .from('exercises')
      .update({ name: name.trim() })
      .eq('id', exercise.id)
    setBusy(false)
    if (error) {
      setError(
        error.code === '23505'
          ? 'An exercise with this name already exists (exercises are shared, so maybe a friend created it).'
          : error.message,
      )
      return
    }
    onRenamed(name.trim())
  }

  async function remove() {
    const ok = window.confirm(
      `Delete "${exercise.name}" and all its logged sets? This cannot be undone.`,
    )
    if (!ok) return
    setBusy(true)
    setError(null)
    // The database also deletes all sets of this exercise (on delete cascade)
    const { error } = await supabase.from('exercises').delete().eq('id', exercise.id)
    if (error) {
      setError(error.message)
      setBusy(false)
      return
    }
    onDeleted()
  }

  return (
    <div className="panel stack">
      <form className="stack" onSubmit={rename}>
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
        <button
          className="button secondary"
          disabled={busy || name.trim() === '' || name.trim() === exercise.name}
        >
          Save name
        </button>
      </form>
      <button type="button" className="button danger" disabled={busy} onClick={remove}>
        Delete exercise
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
