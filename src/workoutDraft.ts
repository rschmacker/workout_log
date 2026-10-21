// The workout builder's working copy of a workout ("draft"), and how it is checked
// and turned into rows for the database. (Only type imports, so it can be tested alone.)
import type { Category } from './exercises'
import type { Workout, WorkoutCategory } from './workouts'

export type DraftExercise = {
  key: string // only for the screen (React needs a stable key per item)
  exerciseId: string
  exercise: string // name
  category: Category
  sets: number
  reps: string
  weight: string
  note: string // Besonderheit
  supersetWithNext: boolean
  // Only used on the first exercise of a superset (or a single exercise):
  title: string
  time: string
  cues: string // one cue per line
}

export type Draft = {
  name: string // '' = named after the main exercises
  category: WorkoutCategory
  warmup: string // one line per item, "- " for bullet points
  finisher: string
  exercises: DraftExercise[]
}

export const LIMITS = {
  name: 100,
  warmup: 2000,
  finisher: 2000,
  hint: 40,
  note: 200,
  title: 60,
  time: 20,
  cues: 1000,
}

let keyCounter = 0
export const newKey = () => `item-${keyCounter++}`

export function emptyDraft(category: WorkoutCategory): Draft {
  return { name: '', category, warmup: '', finisher: '', exercises: [] }
}

export function draftFromWorkout(workout: Workout): Draft {
  return {
    name: workout.givenName,
    category: workout.category,
    warmup: workout.warmup.join('\n'),
    finisher: workout.finisher.join('\n'),
    exercises: workout.blocks.flatMap((block) =>
      block.exercises.map((e, i) => ({
        key: newKey(),
        exerciseId: e.exerciseId,
        exercise: e.exercise,
        category: e.category,
        sets: e.sets,
        reps: e.reps,
        weight: e.weight,
        note: e.note,
        supersetWithNext: i < block.exercises.length - 1,
        title: i === 0 ? block.title : '',
        time: i === 0 ? block.time : '',
        cues: i === 0 ? block.cues.join('\n') : '',
      })),
    ),
  }
}

// Does exercise i start a new group (a single exercise or the first of a superset)?
export function startsGroup(exercises: DraftExercise[], i: number): boolean {
  return i === 0 || !exercises[i - 1].supersetWithNext
}

// The exercises split into groups: [[single], [superset A, superset B], …]
export function groupsOf(exercises: DraftExercise[]): DraftExercise[][] {
  const groups: DraftExercise[][] = []
  exercises.forEach((e, i) => {
    if (startsGroup(exercises, i)) groups.push([e])
    else groups[groups.length - 1].push(e)
  })
  return groups
}

// The automatic name: the main exercises, e.g. "Deadlift + Pull-Up"
export function autoName(draft: Draft): string {
  return draft.exercises.map((e) => e.exercise).join(' + ')
}

// Text lines without empty lines and extra spaces
export function cleanLines(text: string): string {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
}

// A problem that prevents saving, as a message - or null if everything is fine
export function validateDraft(draft: Draft): string | null {
  if (draft.exercises.length === 0) return 'Add at least one main exercise.'
  if (draft.name.trim().length > LIMITS.name) return `The name is too long (max. ${LIMITS.name} characters).`
  if (draft.warmup.length > LIMITS.warmup) return `The warmup is too long (max. ${LIMITS.warmup} characters).`
  if (draft.finisher.length > LIMITS.finisher) return `The finisher is too long (max. ${LIMITS.finisher} characters).`

  const seen = new Set<string>()
  for (const [i, e] of draft.exercises.entries()) {
    const label = `${i + 1}. ${e.exercise}`
    if (seen.has(e.exerciseId)) {
      return `${e.exercise} is in the workout twice. An exercise can only be logged once per day, so remove one.`
    }
    seen.add(e.exerciseId)
    if (!Number.isInteger(e.sets) || e.sets < 1 || e.sets > 5) return `${label}: sets must be 1 to 5.`
    if (e.reps.trim().length > LIMITS.hint || e.weight.trim().length > LIMITS.hint) {
      return `${label}: the hints are too long (max. ${LIMITS.hint} characters).`
    }
    if (e.note.trim().length > LIMITS.note) return `${label}: the Besonderheit is too long.`
    if (e.title.trim().length > LIMITS.title) return `${label}: the title is too long.`
    if (e.time.trim().length > LIMITS.time) return `${label}: the time is too long.`
    if (e.cues.length > LIMITS.cues) return `${label}: the cues are too long.`
  }
  return null
}

// The rows for the database function save_workout
export function draftToRows(draft: Draft) {
  const last = draft.exercises.length - 1
  return draft.exercises.map((e, i) => {
    const first = startsGroup(draft.exercises, i)
    return {
      position: i + 1,
      exercise_id: e.exerciseId,
      sets: e.sets,
      reps_hint: e.reps.trim(),
      weight_hint: e.weight.trim(),
      note: e.note.trim(),
      // The last exercise has no next one to form a superset with
      superset_with_next: i < last && e.supersetWithNext,
      title: first ? e.title.trim() : '',
      duration: first ? e.time.trim() : '',
      cues: first ? cleanLines(e.cues) : '',
    }
  })
}
