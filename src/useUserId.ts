import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// The id of the logged-in user (null while it's being read)
export function useUserId(): string | null {
  const [userId, setUserId] = useState<string | null>(null)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null))
  }, [])
  return userId
}
