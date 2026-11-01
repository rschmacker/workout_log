import { useMemo } from 'react'
import { localData, useLocalData } from './localData'
import { supabase } from './supabase'

type Profile = { id: string; display_name: string }

// Display names of all users (table profiles), e.g. for "by <name>" on workouts,
// with a copy on this phone (see localData.ts)
const profileList = localData('profiles', async () => {
  const { data, error } = await supabase.from('profiles').select('id, display_name')
  if (error) throw error
  return data as Profile[]
})

// The names by user id (null while nothing is loaded yet)
export function useProfiles(): Map<string, string> | null {
  const { data } = useLocalData(profileList)
  return useMemo(() => (data ? new Map(data.map((p) => [p.id, p.display_name])) : null), [data])
}

// "you", the person's name, or "built-in" for workouts without a creator
export function nameOf(
  profiles: Map<string, string> | null,
  userId: string | null,
  myUserId: string | null,
): string {
  if (userId === null) return 'built-in'
  if (userId === myUserId) return 'you'
  return profiles?.get(userId) ?? 'someone'
}

// Saves your own display name. Returns an error message or null.
export async function saveMyName(userId: string, name: string): Promise<string | null> {
  const display_name = name.trim()
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, display_name, updated_at: new Date().toISOString() })
  if (error) return error.message
  profileList.change((list) => [...list.filter((p) => p.id !== userId), { id: userId, display_name }])
  return null
}

// "21 Oct 2026, 09:20" (in the phone's time zone)
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
