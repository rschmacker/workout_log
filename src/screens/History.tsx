import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import WeightChart, { type ChartPoint } from '../components/WeightChart'
import { formatDay } from '../dates'
import PersonalBests from '../components/PersonalBests'
import { fetchEntries, noteFor, type ExerciseEntry } from '../entries'
import {
  bestByVolume,
  bestByWeight,
  fetchAllSets,
  formatWeight,
  type WorkoutSet,
} from '../sets'
import { supabase } from '../supabase'

export default function History() {
  const { id = '' } = useParams()
  const [name, setName] = useState<string | null>(null)
  const [sets, setSets] = useState<WorkoutSet[] | null>(null)
  const [entries, setEntries] = useState<ExerciseEntry[]>([]) // notes of this exercise
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
    Promise.all([fetchAllSets(id), fetchEntries(id)])
      .then(([allSets, allEntries]) => {
        setSets(allSets)
        setEntries(allEntries)
      })
      .catch((e: Error) => setError(e.message))
  }, [id])

  // Group the sets by date (sets come sorted by date, then set number)
  const days = useMemo(() => {
    const byDate = new Map<string, WorkoutSet[]>()
    for (const s of sets ?? []) {
      byDate.set(s.date, [...(byDate.get(s.date) ?? []), s])
    }
    return [...byDate.entries()].map(([date, daySets]) => ({ date, sets: daySets }))
  }, [sets])

  // Top set per day = the heaviest set (if two sets tie, the one with more reps)
  const chartPoints: ChartPoint[] = useMemo(
    () =>
      days.map(({ date, sets: daySets }) => {
        const top = daySets.reduce((best, s) =>
          s.weight_kg > best.weight_kg || (s.weight_kg === best.weight_kg && s.reps > best.reps)
            ? s
            : best,
        )
        return { date, weight: top.weight_kg, reps: top.reps }
      }),
    [days],
  )

  // Dates of the two personal bests, for the badges in the list
  const heaviestDate = useMemo(() => bestByWeight(sets ?? [])?.date, [sets])
  const mostVolumeDate = useMemo(() => bestByVolume(sets ?? [])?.date, [sets])

  return (
    <main className="page">
      <Link className="back-link" to={`/exercise/${id}`}>
        ‹ Back
      </Link>
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
            <h2>Top set weight (kg)</h2>
            <WeightChart points={chartPoints} />
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
                        {heaviestDate === day.date && <span className="pb-badge">Heaviest</span>}
                        {mostVolumeDate === day.date && (
                          <span className="pb-badge">Best volume</span>
                        )}
                      </span>
                      <span>
                        {day.sets
                          .map((s) => `${formatWeight(s.weight_kg)} × ${s.reps}`)
                          .join(' · ')}
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
