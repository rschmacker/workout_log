import { useEffect, useState } from 'react'
import BackLink from '../components/BackLink'
import { buildExportRows, toGermanCsv, type ExportRow } from '../csv'
import { todayISO } from '../dates'
import { fetchEntries } from '../entries'
import { fetchEverySet } from '../sets'
import { supabase } from '../supabase'

// Hands the file to the user: on a phone via the share sheet ("Save to Files",
// AirDrop, Mail …), which also works in the Home Screen app; otherwise as a download.
async function deliverFile(file: File): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const isPhone = window.matchMedia('(pointer: coarse)').matches
  if (isPhone && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled' // closed the share sheet
      // Sharing not allowed: fall back to a download below
    }
  }
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return 'downloaded'
}

export default function Settings({ email }: { email: string | undefined }) {
  // Loaded when the screen opens, so the export button can hand over the file
  // right away (the iPhone share sheet only opens directly after a tap)
  const [rows, setRows] = useState<ExportRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetchEverySet(),
      supabase.from('exercises').select('id, name, category'),
      fetchEntries(),
    ])
      .then(([sets, exercisesResult, entries]) => {
        if (exercisesResult.error) throw exercisesResult.error
        setRows(buildExportRows(sets, exercisesResult.data, entries))
      })
      .catch((e: Error) => setLoadError(e.message))
  }, [])

  async function exportCsv() {
    if (!rows) return
    setMessage(null)
    const file = new File([toGermanCsv(rows)], `workout-log-${todayISO()}.csv`, {
      type: 'text/csv',
    })
    const result = await deliverFile(file)
    if (result === 'shared') setMessage(`Exported ${rows.length} sets.`)
    if (result === 'downloaded') setMessage(`Downloaded ${file.name} (${rows.length} sets).`)
  }

  return (
    <main className="page">
      <BackLink parent="/" />
      <h1>Settings</h1>

      <section className="section">
        <h2>Export</h2>
        <p className="muted">
          All your sets as a CSV file for Excel (German format: semicolons, decimal comma,
          dates as DD.MM.YYYY).
        </p>
        {loadError && <p className="error">Could not load your data: {loadError}</p>}
        <div className="stack">
          <button className="button" disabled={!rows} onClick={exportCsv}>
            {rows ? `Export CSV (${rows.length} sets)` : 'Loading…'}
          </button>
          {message && <p className="success">{message}</p>}
        </div>
      </section>

      <section className="section">
        <h2>Account</h2>
        <p>
          Signed in as <strong>{email}</strong>
        </p>
        <button className="button secondary" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </section>
    </main>
  )
}
