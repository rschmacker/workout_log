import { useEffect, useState, type FormEvent } from 'react'
import { CATEGORIES, categoryLabel, type Category, type Exercise } from '../exercises'
import { supabase } from '../supabase'
import BodyMap from './BodyMap'

type Props = {
  alreadyUsed: Set<string> // exercise ids that are already in the workout
  onPick: (exercise: Exercise) => void
  onCancel: () => void
}

// Choosing an exercise in the workout builder, like on the Home screen:
// first the body part, then its exercises (or a new custom exercise).
export default function ExercisePicker({ alreadyUsed, onPick, onCancel }: Props) {
  const [category, setCategory] = useState<Category | null>(null)
  const [exercises, setExercises] = useState<Exercise[] | null>(null)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function chooseCategory(c: Category | null) {
    setCategory(c)
    setExercises(null)
    setError(null)
    setNewName('')
  }

  useEffect(() => {
    if (!category) return
    supabase
      .from('exercises')
      .select('id, user_id, name, category')
      .eq('category', category)
      .order('name')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setExercises(data as Exercise[])
      })
  }, [category])

  // A new custom exercise in this body part; it's added to the workout right away
  async function addCustom(e: FormEvent) {
    e.preventDefault()
    if (!category) return
    setBusy(true)
    setError(null)
    const { data, error } = await supabase
      .from('exercises')
      .insert({ name: newName.trim(), category })
      .select('id, user_id, name, category')
      .single()
    setBusy(false)
    if (error) {
      setError(
        error.code === '23505'
          ? 'An exercise with this name already exists (maybe in another body part).'
          : error.message,
      )
      return
    }
    onPick(data as Exercise)
  }

  if (!category) {
    return (
      <div>
        <button type="button" className="back-link link-like" onClick={onCancel}>
          ‹ Back to the workout
        </button>
        <h1>Add exercise</h1>
        <div className="tile-grid">
          {CATEGORIES.map((c) => (
            <button key={c} type="button" className="tile" onClick={() => chooseCategory(c)}>
              <BodyMap category={c} />
              {categoryLabel(c)}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <button type="button" className="back-link link-like" onClick={() => chooseCategory(null)}>
        ‹ Body parts
      </button>
      <h1>{categoryLabel(category)}</h1>

      {!exercises && !error && <p className="muted">Loading…</p>}
      <div className="exercise-list">
        {exercises?.map((exercise) => {
          const used = alreadyUsed.has(exercise.id)
          return (
            <button
              key={exercise.id}
              type="button"
              className="card exercise-item"
              disabled={used}
              onClick={() => onPick(exercise)}
            >
              {exercise.name}
              {used && <span className="exercise-last">Already in this workout</span>}
            </button>
          )
        })}
      </div>

      <form className="stack" onSubmit={addCustom}>
        <label className="field">
          Add custom exercise to {categoryLabel(category)}
          <input
            type="text"
            autoCapitalize="words"
            maxLength={60}
            placeholder="Name, e.g. Goblet Squat"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </label>
        <button className="button secondary" disabled={busy || newName.trim() === ''}>
          + Add and use
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  )
}
