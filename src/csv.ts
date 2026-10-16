// CSV export for German Excel: UTF-8 with BOM, semicolons, decimal comma,
// dates as DD.MM.YYYY. (No imports, so it can be tested on its own.)

export type ExportRow = {
  date: string // "YYYY-MM-DD"
  exercise: string
  category: string
  set_number: number
  weight_kg: number
  reps: number
  note: string
  workout: string // empty until saved workouts exist
}

const COLUMNS = [
  'date',
  'exercise',
  'category',
  'set_number',
  'weight_kg',
  'reps',
  'note',
  'workout',
] as const

// Joins sets with their exercise name/category and the day's note,
// sorted by date, then exercise name, then set number.
export function buildExportRows(
  sets: { exercise_id: string; date: string; set_number: number; weight_kg: number; reps: number }[],
  exercises: { id: string; name: string; category: string }[],
  entries: { exercise_id: string; date: string; note: string | null }[],
): ExportRow[] {
  const exerciseById = new Map(exercises.map((e) => [e.id, e]))
  const noteByDay = new Map(entries.map((e) => [`${e.exercise_id}|${e.date}`, e.note ?? '']))

  return sets
    .map((s) => {
      const exercise = exerciseById.get(s.exercise_id)
      return {
        date: s.date,
        exercise: exercise?.name ?? '',
        category: exercise?.category ?? '',
        set_number: s.set_number,
        weight_kg: s.weight_kg,
        reps: s.reps,
        note: noteByDay.get(`${s.exercise_id}|${s.date}`) ?? '',
        workout: '',
      }
    })
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.exercise.localeCompare(b.exercise) ||
        a.set_number - b.set_number,
    )
}

// "2026-10-16" -> "16.10.2026"
function germanDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

// 62.5 -> "62,5", 60 -> "60"
function germanNumber(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',')
}

// One text cell: put it in quotes if it contains ; " or a line break.
// Text starting with = + - @ would be read by Excel as a formula, so it gets a
// leading apostrophe (Excel's "this is text" marker).
function textCell(value: string): string {
  let v = value
  if (/^[=+\-@]/.test(v)) v = `'${v}`
  return /[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export function toGermanCsv(rows: ExportRow[]): string {
  const lines = [COLUMNS.join(';')]
  for (const r of rows) {
    lines.push(
      [
        germanDate(r.date),
        textCell(r.exercise),
        textCell(r.category),
        String(r.set_number),
        germanNumber(r.weight_kg),
        String(r.reps),
        textCell(r.note),
        textCell(r.workout),
      ].join(';'),
    )
  }
  // The byte order mark (U+FEFF) tells Excel the file is UTF-8, so ä/ö/ü show correctly
  return String.fromCharCode(0xfeff) + lines.join('\r\n') + '\r\n'
}
