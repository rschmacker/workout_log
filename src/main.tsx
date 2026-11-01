import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createHashRouter, RouterProvider } from 'react-router'
import './index.css'
import App from './App.tsx'

// iPhone Safari only shows :active (pressed) styles if the page listens for touches
document.addEventListener('touchstart', () => {}, { passive: true })

// Keep the app's files on the phone, so it opens without internet (src/serviceWorker.js).
// Only in the built app: during `npm run dev` it would get in the way of live reloading.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((registration) => {
        // Also look for a new version when the app comes back to the front
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') registration.update().catch(() => {})
        })
      })
      .catch(() => {}) // not possible (e.g. private browsing): the app just needs internet to start
  })
}

// Hash routing keeps the page path in the URL after a "#" (e.g. .../workout_log/#/history).
// GitHub Pages only knows about index.html, so this avoids 404s when reloading a sub-page.
// (A "data router", so screens like the workout builder can warn before you leave them.)
const router = createHashRouter([{ path: '*', element: <App /> }])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
