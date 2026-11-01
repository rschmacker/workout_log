import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import BackLink from '../components/BackLink'
import ProgressChart, { type ChartPoint } from '../components/ProgressChart'
import { formatDay } from '../dates'
import PersonalBests from '../components/PersonalBests'
import { noteFor, useMyEntries } from '../entries'
import { useExercises } from '../exercises'
import { loadingError } from '../localData'
import {
  bestByVolume,
  bestByWeight,
  describeSet,
  formatVolume,
  formatWeight,
  shortSet,
  useMySets,
  volume,
  type WorkoutSet,
} from '../sets'

// Which chart is shown, remembered on this phone (if the browser allows it)
type ChartKind = 'weight' | 'volume'
const CHART_KEY = 'history-chart'
function savedChart(): ChartKind {
  try {
    return localStorage.getItem(CHART_KEY) === 'volume' ? 'volume' : 'weight'
  } catch {
    return 'weight'
  }
}

export default function History() {
  const { id = '' } = useParams()
  const exercisesState = useExercises()
  const setsState = useMySets()
  const entriesState = useMyEntries()
  const error = loadingError(exercisesState, setsState, entriesState)
  const name = exercisesState.data?.find((e) => e.id === id)?.name

  // The sets of this exercise (sorted by date, then set number)
  const allSets = setsState.data
  const sets = useMemo(() => allSets?.filter((s) => s.exercise_id === id), [allSets, id])
  const entries = entriesState.data ?? [] // your notes (of all exercises)

  // Group the sets by date
  const days = useMemo(() => {
    const byDate = new Map<string, WorkoutSet[]>()
    for (const s of sets ?? []) {
      byDate.set(s.date, [...(byDate.get(s.date) ?? []), s])
    }
    return [...byDate.entries()].map(([date, daySets]) => ({ date, sets: daySets }))
  }, [sets])

  // The chart shows the heaviest set or the best volume (weight × reps) of each day.
  // Bodyweight-only exercises have no weight and no volume: the most reps instead.
  const [chart, setChart] = useState<ChartKind>(savedChart)
  const bodyweightOnly = (sets ?? []).every((s) => s.weight_kg === 0)
  const chartPoints: ChartPoint[] = useMemo(
    () =>
      days.map(({ date, sets: daySets }) => {
        if (chart === 'volume' && !bodyweightOnly) {
          const best = bestByVolume(daySets)!
          return { date, value: volume(best), label: `${describeSet(best)} = ${formatVolume(volume(best))}` }
        }
        // Heaviest set; if two sets tie, the one with more reps
        const heaviest = bestByWeight(daySets)!
        return {
          date,
          value: bodyweightOnly ? heaviest.reps : heaviest.weight_kg,
          label: describeSet(heaviest),
        }
      }),
    [days, chart, bodyweightOnly],
  )

  function chooseChart(value: ChartKind) {
    setChart(value)
    try {
      localStorage.setItem(CHART_KEY, value)
    } catch {
      // Storage not available: the choice just isn't remembered
    }
  }

  // Dates of the two personal bests, for the badges in the list
  const heaviestDate = useMemo(() => bestByWeight(sets ?? [])?.date, [sets])
  const mostVolumeDate = useMemo(() => bestByVolume(sets ?? [])?.date, [sets])

  return (
    <main className="page">
      <BackLink parent={`/exercise/${id}`} />
      <h1>{name ?? 'History'}</h1>

      {error && <p className="error">Could not load history: {error}</p>}
      {!sets && !error && <p className="muted">Loading…</p>}
      {sets && days.length === 0 && <p className="muted">No sets logged yet.</p>}

      {days.length > 0 && (
        <>
          <section className="section">
            <h2>Personal bests</h2>
            <PersonalBests sets={sets ?? []} />
          </section>

          <section className="section">
            {bodyweightOnly ? (
              <h2>Most reps per day</h2>
            ) : (
              <>
                <h2>Progress per day</h2>
                <div className="choice-grid chart-choice" role="group" aria-label="Chart shows">
                  {(['weight', 'volume'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      className="choice"
                      aria-pressed={chart === value}
                      onClick={() => chooseChart(value)}
                    >
                      {value === 'weight' ? 'Heaviest' : 'Best volume'}
                    </button>
                  ))}
                </div>
              </>
            )}
            <ProgressChart
              points={chartPoints}
              wholeNumbers={bodyweightOnly}
              formatValue={(v) =>
                bodyweightOnly
                  ? `${v} reps`
                  : chart === 'volume'
                    ? formatVolume(v)
                    : v === 0
                      ? 'BW'
                      : `${formatWeight(v)} kg`
              }
              description={
                bodyweightOnly
                  ? 'Most reps per day'
                  : chart === 'volume'
                    ? 'Best volume (weight × reps) per day'
                    : 'Heaviest set per day'
              }
            />
          </section>

          <section className="section">
            <h2>All sessions</h2>
            <ul className="history-list">
              {[...days].reverse().map((day) => {
                const note = noteFor(entries, id, day.date)
                return (
                  <li key={day.date}>
                    <Link className="history-item" to={`/exercise/${id}?date=${day.date}`}>
                      <span className="history-date">
                        {formatDay(day.date)}
                        {heaviestDate === day.date && (
                          <span className="pb-badge">{bodyweightOnly ? 'Most reps' : 'Heaviest'}</span>
                        )}
                        {mostVolumeDate === day.date && !bodyweightOnly && (
                          <span className="pb-badge">Best volume</span>
                        )}
                      </span>
                      <span>
                        {day.sets.map(shortSet).join(' · ')}
                      </span>
                      {note && <span className="note-text">{note}</span>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        </>
      )}
    </main>
  )
}
