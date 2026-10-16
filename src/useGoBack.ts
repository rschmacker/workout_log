import { useLocation, useNavigate } from 'react-router'

// Goes back to the screen you came from (one level up in normal use).
// If this screen was opened directly (e.g. after a reload), there is nothing to go
// back to in the app, so it goes to `parent` instead.
export function useGoBack() {
  const navigate = useNavigate()
  const location = useLocation()
  // React Router gives the very first screen of a visit the key "default"
  const cameFromApp = location.key !== 'default'
  return (parent: string) => {
    if (cameFromApp) navigate(-1)
    else navigate(parent, { replace: true })
  }
}
