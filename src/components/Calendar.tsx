import { useState } from 'react'
import { parseISODate, toISODate, todayISO } from '../dates'

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

type Props = {
  selected: string // "YYYY-MM-DD"
  onSelect: (date: string) => void
  markedDates: Set<string> // dates that get a dot (sets logged)
}

// Month grid, weeks start on Monday.
export default function Calendar({ selected, onSelect, markedDates }: Props) {
  // The month currently shown, as the 1st day of that month
  const [month, setMonth] = useState(() => {
    const d = parseISODate(selected)
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  // getDay(): 0 = Sunday … 6 = Saturday. Shift so Monday = 0.
  const leadingBlanks = (month.getDay() + 6) % 7
  const today = todayISO()

  const cells: (string | null)[] = [
    ...Array<null>(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      toISODate(new Date(year, monthIndex, i + 1)),
    ),
  ]

  return (
    <div className="calendar">
      <div className="calendar-header">
        <button
          type="button"
          className="calendar-nav"
          aria-label="Previous month"
          onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}
        >
          ‹
        </button>
        <span>
          {month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
        </span>
        <button
          type="button"
          className="calendar-nav"
          aria-label="Next month"
          onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}
        >
          ›
        </button>
      </div>

      <div className="calendar-grid">
        {WEEKDAYS.map((w) => (
          <span key={w} className="calendar-weekday">
            {w}
          </span>
        ))}
        {cells.map((date, i) =>
          date === null ? (
            <span key={`blank-${i}`} />
          ) : (
            <button
              key={date}
              type="button"
              className={[
                'calendar-day',
                date === selected && 'selected',
                date === today && 'today',
                markedDates.has(date) && 'marked',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-pressed={date === selected}
              onClick={() => onSelect(date)}
            >
              {parseISODate(date).getDate()}
            </button>
          ),
        )}
      </div>
    </div>
  )
}
