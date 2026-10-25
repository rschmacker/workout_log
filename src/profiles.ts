import { supabase } from './supabase'

// Display names of all users (table profiles), e.g. for "by <name>" on workouts.
// Loaded once per app start; changing your own name reloads them.
let cache: Promise<Map<string, string>> | null = null

export function fetchProfiles(): Promise<Map<string, string>> {
  cache ??= (async () => {
    const { data, error } = await supabase.from('profiles').select('id, display_name')
    if (error) {
      cache = null // try again next time
      throw error
    }
    return new Map(data.map((p) => [p.id as string, p.display_name as string]))
  })()
  return cache
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
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, display_name: name.trim(), updated_at: new Date().toISOString() })
  cache = null
  return error ? error.message : null
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
