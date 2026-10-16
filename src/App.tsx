import { useEffect } from 'react'
import { Link, Route, Routes } from 'react-router'
import Login from './Login'
import AddExercise from './screens/AddExercise'
import ExerciseList from './screens/ExerciseList'
import ExerciseScreen from './screens/ExerciseScreen'
import History from './screens/History'
import Home from './screens/Home'
import Settings from './screens/Settings'
import WorkoutList from './screens/WorkoutList'
import WorkoutScreen from './screens/WorkoutScreen'
import { useSession } from './useSession'
import { forgetWorkoutExercises, workoutExercises } from './workoutExercises'

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
  const userId = session?.user.id

  // After logging in: create exercises that are new in a workout file, so they also
  // appear on the Home screen. (Errors show up on the workout screen instead.)
  useEffect(() => {
    if (userId) workoutExercises().catch(() => {})
    else forgetWorkoutExercises()
  }, [userId])

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
      <Route path="/exercises/:category" element={<ExerciseList />} />
      <Route path="/workouts/:type" element={<WorkoutList />} />
      <Route path="/workout/:slug" element={<WorkoutScreen />} />
      <Route path="/add-exercise" element={<AddExercise />} />
      <Route path="/exercise/:id" element={<ExerciseScreen />} />
      <Route path="/exercise/:id/history" element={<History />} />
      <Route path="/settings" element={<Settings email={session.user.email} />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
