import { isAuthRetryableFetchError, type Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { clearLocalData, setLocalDataUser } from './localData'
import { authStorageKey, cleanLoginParamsFromUrl, supabase } from './supabase'

// The login saved on this phone from last time, read once when the app starts. The app
// opens with it right away, without waiting for Supabase to check it (or for internet).
function readSavedSession(): Session | null {
  try {
    const saved = JSON.parse(localStorage.getItem(authStorageKey) ?? 'null')
    return saved?.user?.id ? (saved as Session) : null
  } catch {
    return null
  }
}
const savedSession = readSavedSession()
setLocalDataUser(savedSession?.user.id ?? null)

// Returns the current login session:
// undefined = still checking, null = logged out, Session = logged in.
export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(savedSession ?? undefined)

  useEffect(() => {
    // getSession() also finishes a login that just came back from GitHub / the email
    // link, and renews a login older than an hour
    supabase.auth.getSession().then(({ data, error }) => {
      cleanLoginParamsFromUrl()
      // No internet to renew the login: keep using the saved one. Supabase renews it
      // by itself once the connection is back.
      if (!data.session && error && isAuthRetryableFetchError(error)) return
      setLocalDataUser(data.session?.user.id ?? null)
      setSession(data.session)
    })

    // Keep in sync when logging in or out, and when the login is renewed
    const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'INITIAL_SESSION') return // handled by getSession() above
      // Signed out: delete the copy of your data from this phone
      if (event === 'SIGNED_OUT') clearLocalData()
      setLocalDataUser(newSession?.user.id ?? null)
      setSession(newSession)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return session
}
