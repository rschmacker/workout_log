import { formatDay } from '../dates'
import {
  bestByVolume,
  bestByWeight,
  describeSet,
  formatVolume,
  volume,
  type WorkoutSet,
} from '../sets'

// Box with both personal bests: heaviest set and best volume (weight × reps).
// Shows nothing if no sets are logged yet. For bodyweight-only exercises the volume
// is 0, so only the best set (most reps) is shown.
export default function PersonalBests({ sets }: { sets: WorkoutSet[] }) {
  const heaviest = bestByWeight(sets)
  const mostVolume = bestByVolume(sets)
  if (!heaviest || !mostVolume) return null
  const bodyweightOnly = volume(mostVolume) === 0

  return (
    <dl className="pb-box">
      <dt>{bodyweightOnly ? 'Most reps' : 'Heaviest'}</dt>
      <dd>
        <strong>{describeSet(heaviest)}</strong>
        <span className="muted">{formatDay(heaviest.date)}</span>
      </dd>
      {!bodyweightOnly && (
        <>
          <dt>Best volume</dt>
          <dd>
            <strong>
              {describeSet(mostVolume)} = {formatVolume(volume(mostVolume))}
            </strong>
            <span className="muted">{formatDay(mostVolume.date)}</span>
          </dd>
        </>
      )}
    </dl>
  )
}
