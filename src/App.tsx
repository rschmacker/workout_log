import { Link, Route, Routes } from 'react-router'
import Login from './Login'
import AddExercise from './screens/AddExercise'
import ExerciseScreen from './screens/ExerciseScreen'
import History from './screens/History'
import Home from './screens/Home'
import { useSession } from './useSession'

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
      <Route path="/" element={<Home />} />
      <Route path="/add-exercise" element={<AddExercise />} />
      <Route path="/exercise/:id" element={<ExerciseScreen />} />
      <Route path="/exercise/:id/history" element={<History />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
