import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { cleanLoginParamsFromUrl, supabase } from './supabase'

// Returns the current login session:
// undefined = still checking, null = logged out, Session = logged in.
export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    // getSession() also finishes a login that just came back from GitHub / the email link
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      cleanLoginParamsFromUrl()
    })

    // Keep in sync when logging in or out
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return session
}
