import { useEffect, useState } from 'react'
import { Link, Route, Routes } from 'react-router'
import Login from './Login'
import { supabase } from './supabase'
import { useSession } from './useSession'

// Placeholder Home for step 2: shows who is logged in and checks the database.
// The real Home, Exercise and History screens replace this in later steps.
function Home({ email }: { email: string | undefined }) {
  const [dbStatus, setDbStatus] = useState('Checking database…')

  useEffect(() => {
    supabase
      .from('exercises')
      .select('id', { count: 'exact', head: true })
      .then(({ count, error }) => {
        setDbStatus(
          error
            ? `Database error: ${error.message}`
            : `Database OK: ${count} exercises visible.`,
        )
      })
  }, [])

  return (
    <main className="page">
      <h1>Workout Log</h1>
      <p>
        Signed in as <strong>{email}</strong>
      </p>
      <p className="muted">{dbStatus}</p>
      <button className="button secondary" onClick={() => supabase.auth.signOut()}>
        Sign out
      </button>
    </main>
  )
}

function NotFound() {
  return (
    <main className="page">
      <h1>Page not found</h1>
      <Link className="button" to="/">
        Back to Home
      </Link>
    </main>
  )
}

export default function App() {
  const session = useSession()

  if (session === undefined) {
    return (
      <main className="page">
        <p className="muted">Loading…</p>
      </main>
    )
  }

  if (session === null) return <Login />

  return (
    <Routes>
      <Route path="/" element={<Home email={session.user.email} />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
