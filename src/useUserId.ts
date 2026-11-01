import { currentUserId } from './localData'

// The id of the logged-in user. The screens are only shown while you're logged in,
// so it's known right away.
export function useUserId(): string | null {
  return currentUserId()
}
