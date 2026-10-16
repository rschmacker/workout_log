import { Link } from 'react-router'
import BodyMap from '../components/BodyMap'
import { CATEGORIES, categoryLabel, categorySlug } from '../exercises'
import { WORKOUT_TYPES } from '../workouts'

export default function Home() {
  return (
    <main className="page">
      <header className="topbar">
        <h1>Workout Log</h1>
        <Link className="pill-link" to="/settings">
          Settings
        </Link>
      </header>

      <section className="section">
        <h2>Exercises</h2>
        <div className="tile-grid">
          {CATEGORIES.map((category) => (
            <Link key={category} className="tile" to={`/exercises/${categorySlug(category)}`}>
              <BodyMap category={category} />
              {categoryLabel(category)}
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Workouts</h2>
        <div className="tile-row">
          {WORKOUT_TYPES.map((type) => (
            <Link key={type.slug} className="tile tile-small" to={`/workouts/${type.slug}`}>
              {type.label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
