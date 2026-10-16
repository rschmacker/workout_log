// Types of saved workouts, shown in the "Workouts" section of the Home screen.
// The workouts themselves come in a later step (TODO item 4).
export const WORKOUT_TYPES = [
  { slug: 'upper-body', label: 'Upper body' },
  { slug: 'lower-body', label: 'Lower body' },
  { slug: 'full-body', label: 'Full body' },
] as const
