import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error(
    'Missing Supabase settings. Copy .env.example to .env.local, fill in the values and restart "npm run dev".',
  )
}

export const supabase = createClient(url, key, {
  auth: {
    // "pkce" returns from GitHub with "?code=..." instead of "#access_token=...",
    // which would clash with the "#/..." paths of the HashRouter.
    flowType: 'pkce',
  },
})

// Where GitHub / the email link should send you back to after logging in,
// e.g. http://localhost:5173/workout_log/ or https://rschmacker.github.io/workout_log/
export const appUrl = window.location.origin + import.meta.env.BASE_URL

// If a login failed, Supabase sends us back with "?error_description=..." in the URL.
// Read it once at startup so the login screen can show it.
export const loginErrorFromUrl = new URLSearchParams(window.location.search).get(
  'error_description',
)

// Remove "?code=..." / "?error=..." from the address bar after the login was handled.
export function cleanLoginParamsFromUrl() {
  if (window.location.search) {
    window.history.replaceState(null, '', appUrl + window.location.hash)
  }
}
