import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { formatDay, parseISODate } from '../dates'
import { formatWeight } from '../sets'

export type ChartPoint = {
  date: string // "YYYY-MM-DD"
  weight: number // top set weight in kg
  reps: number // reps of that top set
}

const HEIGHT = 236
const MARGIN = { top: 24, right: 20, bottom: 44, left: 44 } // bottom: room for 2-line dates
const DAY_MS = 24 * 60 * 60 * 1000

// Round tick steps: 1, 2, 2.5, 5, 10, 20, 25, 50 … so the y-axis shows clean numbers
function niceStep(range: number, targetTicks: number): number {
  const rough = range / targetTicks
  const power = 10 ** Math.floor(Math.log10(rough))
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * power >= rough) return m * power
  }
  return 10 * power
}

// Axis label in two lines: "13 Oct" above "2026" (just "Oct" above "2026" for long ranges)
function axisDate(date: string, longRange: boolean): [string, string] {
  const d = parseISODate(date)
  const top = d.toLocaleDateString(
    'en-GB',
    longRange ? { month: 'short' } : { day: 'numeric', month: 'short' },
  )
  return [top, String(d.getFullYear())]
}

// Line chart of the top set weight per day. Hand-made SVG, so no chart library is needed.
// Tap or drag across the chart to see the value of the nearest day.
export default function WeightChart({ points }: { points: ChartPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [active, setActive] = useState<number | null>(null) // index of highlighted point

  // Measure the available width so text stays the same size on every screen
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right)
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom

  // x: days since the first point; y: kg
  const times = points.map((p) => parseISODate(p.date).getTime())
  const firstTime = times[0]
  const spanDays = (times[times.length - 1] - firstTime) / DAY_MS
  const xOf = (i: number) =>
    MARGIN.left + (spanDays === 0 ? plotWidth / 2 : ((times[i] - firstTime) / DAY_MS / spanDays) * plotWidth)

  const weights = points.map((p) => p.weight)
  const step = niceStep(Math.max(Math.max(...weights) - Math.min(...weights), 10), 4)
  let yMin = Math.floor(Math.min(...weights) / step) * step
  let yMax = Math.ceil(Math.max(...weights) / step) * step
  // All points at the same weight: add a step above and below so the line sits in the middle
  if (yMax === yMin) {
    yMin = Math.max(0, yMin - step)
    yMax += step
  }
  const yOf = (w: number) => MARGIN.top + (1 - (w - yMin) / (yMax - yMin)) * plotHeight
  const yTicks: number[] = []
  for (let v = yMin; v <= yMax + 1e-9; v += step) yTicks.push(Math.round(v * 100) / 100)

  // Show first, middle and last date under the axis.
  // The middle label is skipped if it would overlap the first or last one.
  const longRange = spanDays > 300
  const LABEL_SPACE = 70 // px, roughly the width of "13 Oct" plus a gap
  const middle = Math.floor((points.length - 1) / 2)
  const middleFits =
    xOf(middle) - xOf(0) >= LABEL_SPACE && xOf(points.length - 1) - xOf(middle) >= LABEL_SPACE
  const xLabelIndexes =
    points.length === 1 ? [0] : middleFits ? [0, middle, points.length - 1] : [0, points.length - 1]

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i)},${yOf(p.weight)}`).join(' ')
  const showAllDots = points.length <= 30
  const last = points.length - 1

  // Find the point closest to the finger / mouse position
  function nearestIndex(clientX: number): number {
    const rect = containerRef.current!.getBoundingClientRect()
    const x = clientX - rect.left
    let best = 0
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(xOf(i) - x) < Math.abs(xOf(best) - x)) best = i
    }
    return best
  }

  function onPointer(e: PointerEvent) {
    setActive(nearestIndex(e.clientX))
  }

  // Arrow keys move the highlight when the chart has keyboard focus
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const delta = e.key === 'ArrowLeft' ? -1 : 1
      setActive((a) => Math.min(last, Math.max(0, (a ?? last) + delta)))
    }
  }

  const activePoint = active !== null ? points[active] : null

  return (
    <div className="chart" ref={containerRef}>
      {width > 0 && (
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label="Top set weight over time"
          tabIndex={0}
          onPointerDown={onPointer}
          onPointerMove={onPointer}
          onPointerLeave={() => setActive(null)}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
        >
          {/* Horizontal gridlines with kg labels */}
          {yTicks.map((v) => (
            <g key={v}>
              <line
                className="chart-grid"
                x1={MARGIN.left}
                x2={width - MARGIN.right}
                y1={yOf(v)}
                y2={yOf(v)}
              />
              <text className="chart-axis" x={MARGIN.left - 8} y={yOf(v)} textAnchor="end" dy="0.35em">
                {formatWeight(v)}
              </text>
            </g>
          ))}

          {/* Dates along the bottom */}
          {xLabelIndexes.map((i) => {
            const [top, year] = axisDate(points[i].date, longRange)
            return (
              <text
                key={i}
                className="chart-axis"
                y={HEIGHT - 24}
                textAnchor={
                  points.length === 1 ? 'middle' : i === 0 ? 'start' : i === last ? 'end' : 'middle'
                }
              >
                <tspan x={xOf(i)}>{top}</tspan>
                <tspan x={xOf(i)} dy="1.3em">
                  {year}
                </tspan>
              </text>
            )
          })}

          {/* Crosshair at the highlighted day */}
          {activePoint && (
            <line
              className="chart-crosshair"
              x1={xOf(active!)}
              x2={xOf(active!)}
              y1={MARGIN.top}
              y2={MARGIN.top + plotHeight}
            />
          )}

          <path className="chart-line" d={linePath} />

          {points.map((p, i) =>
            showAllDots || i === last || i === active ? (
              <circle
                key={p.date}
                className="chart-dot"
                cx={xOf(i)}
                cy={yOf(p.weight)}
                r={i === active ? 6 : 4}
              />
            ) : null,
          )}

          {/* Label only the latest value */}
          {active === null && (
            <text
              className="chart-label"
              x={xOf(last)}
              y={yOf(points[last].weight) - 12}
              textAnchor={points.length === 1 ? 'middle' : 'end'}
            >
              {formatWeight(points[last].weight)} kg
            </text>
          )}
        </svg>
      )}

      {/* Tooltip for the highlighted day */}
      {activePoint && (
        <div
          className="chart-tooltip"
          style={{
            left: Math.min(Math.max(xOf(active!), 70), width - 70),
          }}
        >
          <strong>
            {formatWeight(activePoint.weight)} kg × {activePoint.reps}
          </strong>
          <span>{formatDay(activePoint.date)}</span>
        </div>
      )}
    </div>
  )
}
