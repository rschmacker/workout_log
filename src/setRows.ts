// The 5 set rows on the exercise screen, and how weights are prefilled between them.

// What is typed into one row (kept as text so "62," doesn't jump around while typing).
// ownWeight = the weight was typed (or saved) by you; otherwise it was prefilled
// from the set above.
export type RowInput = { weight: string; reps: string; ownWeight: boolean }

export function emptyRows(count: number): RowInput[] {
  return Array.from({ length: count }, () => ({ weight: '', reps: '', ownWeight: false }))
}

// A prefilled weight: copied from the set above, and that row has no reps yet
export function isPrefilled(row: RowInput): boolean {
  return !row.ownWeight && row.weight !== '' && row.reps === ''
}

// When you tap into a row: if its weight is still empty, copy the weight of the
// set above. Returns the same array if nothing changed.
export function prefillRow(rows: RowInput[], index: number): RowInput[] {
  const above = rows[index - 1]
  if (!above || above.weight === '' || rows[index].weight !== '') return rows
  return rows.map((row, i) =>
    i === index ? { ...row, weight: above.weight, ownWeight: false } : row,
  )
}

// Change one field of one row.
// Typing in a weight field makes that weight yours (no longer shown as prefilled).
export function updateRows(
  rows: RowInput[],
  index: number,
  field: 'weight' | 'reps',
  value: string,
): RowInput[] {
  return rows.map((row, i) => {
    if (i !== index) return row
    return field === 'weight'
      ? { ...row, weight: value, ownWeight: true }
      : { ...row, reps: value }
  })
}

// Rows that are skipped on save: empty, or only a prefilled weight without reps
export function isSkipped(row: RowInput): boolean {
  return row.reps.trim() === '' && (row.weight.trim() === '' || isPrefilled(row))
}
