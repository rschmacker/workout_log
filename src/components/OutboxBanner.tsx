import { useExercises } from '../exercises'
import { useOutbox } from '../outbox'

// At the bottom of every screen while logged days are saved on this phone but could
// not be uploaded yet. (Nothing is shown while an upload is simply on its way.)
export default function OutboxBanner() {
  const { changes, problem } = useOutbox()
  const { data: exercises } = useExercises()
  if (changes.length === 0 || !problem) return null

  const names = [
    ...new Set(
      changes.map((c) => exercises?.find((e) => e.id === c.exerciseId)?.name ?? 'an exercise'),
    ),
  ]
  return (
    <div className="outbox-banner" role="status">
      <strong>Not uploaded yet:</strong> {names.join(', ')}. Saved on this phone. {problem}
    </div>
  )
}
