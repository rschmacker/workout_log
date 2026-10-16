import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import './index.css'
import App from './App.tsx'

// iPhone Safari only shows :active (pressed) styles if the page listens for touches
document.addEventListener('touchstart', () => {}, { passive: true })

// HashRouter keeps the page path in the URL after a "#" (e.g. .../workout_log/#/history).
// GitHub Pages only knows about index.html, so this avoids 404s when reloading a sub-page.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
