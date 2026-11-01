import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error(
    'Missing Supabase settings. Copy .env.example to .env.local, fill in the values and restart "npm run dev".',
  )
}

// Where Supabase saves the login on this phone. This is Supabase's own default name,
// written out so the app can read the saved login at startup (see useSession.ts).
export const authStorageKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`

export const supabase = createClient(url, key, {
  auth: {
    // "pkce" returns from GitHub with "?code=..." instead of "#access_token=...",
    // which would clash with the "#/..." paths of the HashRouter.
    flowType: 'pkce',
    storageKey: authStorageKey,
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

// Error text for things that need internet (workouts, custom exercises, your name …):
// a failed connection gets a clearer message than the browser's "Load failed"
export function errorText(message: string): string {
  return !navigator.onLine || /load failed|failed to fetch|networkerror|abort|timeout/i.test(message)
    ? 'No connection – this needs internet. Please try again when you have reception.'
    : message
}

// Remove "?code=..." / "?error=..." from the address bar after the login was handled.
export function cleanLoginParamsFromUrl() {
  if (window.location.search) {
    window.history.replaceState(null, '', appUrl + window.location.hash)
  }
}
