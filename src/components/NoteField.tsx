import { useId, useState } from 'react'
import { suggestNotes } from '../noteSuggestions'

type Props = {
  value: string
  onChange: (note: string) => void
  // All your earlier notes, used for the suggestions
  entries: { exercise_id: string; date: string; note: string | null }[]
  exerciseId: string
}

// "Besonderheiten" text field. While you type, matching earlier notes are shown
// above the field (so the iPhone keyboard doesn't cover them); tap one to use it.
export default function NoteField({ value, onChange, entries, exerciseId }: Props) {
  const inputId = useId()
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestions = showSuggestions ? suggestNotes(entries, exerciseId, value) : []

  return (
    <div className="field note-field">
      <label htmlFor={inputId}>Besonderheiten</label>
      <div className="note-input">
        {suggestions.length > 0 && (
          <ul className="suggestions">
            {suggestions.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  // Keep the keyboard open while tapping a suggestion
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(s)
                    setShowSuggestions(false)
                  }}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          id={inputId}
          type="text"
          maxLength={200}
          autoComplete="off"
          enterKeyHint="done"
          placeholder="e.g. wide grip, 3s down"
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setShowSuggestions(true)
          }}
          // Delayed, so a tap on a suggestion still counts before the list closes
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onKeyDown={(e) => {
            // Return closes the keyboard instead of saving the form
            if (e.key === 'Enter') {
              e.preventDefault()
              e.currentTarget.blur()
            }
          }}
        />
      </div>
    </div>
  )
}
