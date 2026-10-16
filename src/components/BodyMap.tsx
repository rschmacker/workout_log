import Model, { type Muscle } from 'react-body-highlighter'
import { categoryLabel, type Category } from '../exercises'

// Which muscles to highlight for each body part, and whether the body is seen from
// the front or the back. Names are those of react-body-highlighter
// (MIT license, github.com/giavinh79/react-body-highlighter).
const MUSCLES: Record<Category, { view: 'anterior' | 'posterior'; muscles: Muscle[] }> = {
  Chest: { view: 'anterior', muscles: ['chest'] },
  Back: {
    view: 'posterior',
    muscles: ['upper-back', 'trapezius', 'lower-back', 'gluteal', 'hamstring'],
  },
  // The package calls the inner thigh in the front view "abductors"; anatomically
  // these are the adductors
  Legs: { view: 'anterior', muscles: ['quadriceps', 'calves', 'abductors'] },
  Shoulders: { view: 'anterior', muscles: ['front-deltoids'] },
  Arms: { view: 'anterior', muscles: ['biceps', 'triceps', 'forearm'] },
  Core: { view: 'anterior', muscles: ['abs', 'obliques'] },
}

// The colors come from CSS variables, so they follow the app's color theme
const HIGHLIGHT = ['var(--body-highlight)']
const BASE = 'var(--body-base)'

// Body figure with the muscles of one body part highlighted
export default function BodyMap({ category }: { category: Category }) {
  const { view, muscles } = MUSCLES[category]
  return (
    <div
      className="body-map"
      role="img"
      aria-label={`${categoryLabel(category)} muscles highlighted`}
    >
      <Model
        type={view}
        data={[{ name: category, muscles }]}
        highlightedColors={HIGHLIGHT}
        bodyColor={BASE}
      />
    </div>
  )
}
