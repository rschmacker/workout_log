import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createHashRouter, RouterProvider } from 'react-router'
import './index.css'
import App from './App.tsx'

// iPhone Safari only shows :active (pressed) styles if the page listens for touches
document.addEventListener('touchstart', () => {}, { passive: true })

// Hash routing keeps the page path in the URL after a "#" (e.g. .../workout_log/#/history).
// GitHub Pages only knows about index.html, so this avoids 404s when reloading a sub-page.
// (A "data router", so screens like the workout builder can warn before you leave them.)
const router = createHashRouter([{ path: '*', element: <App /> }])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
