// Format of the workout files in workouts/*.json, and the checks run on them.
// Used when building the app (errors stop the build) and by the app to read them.
// Documented for humans in workouts/README.md.
import { BUILT_IN_EXERCISES } from './builtInExercises.ts'
import { CATEGORIES, type Category } from './exercises.ts'

export const WORKOUT_CATEGORIES = ['upper body', 'lower body', 'full body'] as const
export type WorkoutCategory = (typeof WORKOUT_CATEGORIES)[number]

export type MainExercise = {
  index: number // position in the whole workout (0, 1, 2, …), used in the URL
  exercise: string // exercise name as in the library
  category: Category | null // only for exercises that aren't built in (created for you)
  note: string // Besonderheit, e.g. "wide grip"
  sets: number // prescribed number of sets (1-5)
  reps: string // hint, e.g. "6-8"
  weight: string // hint, e.g. "RPE 8" or "60 kg"
}

// One part of the main workout: a single exercise, or a superset of several
export type Block = {
  title: string // e.g. "Chest & Lat Pump"
  time: string // e.g. "18 min"
  cues: string[] // e.g. ["RIR 1-2", "3 sec eccentric", ">2 min rest"]
  exercises: MainExercise[] // more than one = superset
}

export type Workout = {
  slug: string // from the file name, used in the URL
  name: string // given, or made from the main exercises
  category: WorkoutCategory
  warmup: string[]
  blocks: Block[]
  exercises: MainExercise[] // all main exercises of all blocks, in order
  finisher: string[]
}

const MAX_SETS = 5
const WORKOUT_FIELDS = ['name', 'category', 'warmup', 'main', 'finisher']
const EXERCISE_FIELDS = ['exercise', 'category', 'note', 'sets', 'reps', 'weight']
const BLOCK_FIELDS = ['title', 'time', 'cues']

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const quote = (s: string) => `"${s}"`

// So an exercise name can be used inside a search pattern
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// "Back/Hinge" is how the app shows the "Back" category, so accept both
function toCategory(value: unknown): Category | null {
  if (typeof value !== 'string') return null
  const v = value.trim().toLowerCase()
  if (v === 'back/hinge') return 'Back'
  return CATEGORIES.find((c) => c.toLowerCase() === v) ?? null
}

// Optional short text; numbers are allowed too ("reps": 10)
function shortText(value: unknown, field: string, where: string, errors: string[], max = 40): string {
  if (value === undefined) return ''
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string' && value.length <= max) return value.trim()
  errors.push(`${where}: "${field}" must be a short text (max. ${max} characters)`)
  return ''
}

function textList(value: unknown, field: string, where: string, errors: string[]): string[] {
  if (value === undefined) return []
  if (Array.isArray(value) && value.every((s) => typeof s === 'string' && s.trim() !== '')) {
    return value.map((s: string) => s.trim())
  }
  errors.push(`${where}: "${field}" must be a list of texts, e.g. ["5 min row", "Band pull-aparts"]`)
  return []
}

function checkFields(obj: Record<string, unknown>, allowed: string[], where: string, errors: string[]) {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      errors.push(`${where}: unknown field "${key}" (allowed: ${allowed.join(', ')})`)
    }
  }
}

function parseExercise(
  item: unknown,
  where: string,
  allowed: string[],
  errors: string[],
): Omit<MainExercise, 'index'> | null {
  if (!isObject(item)) {
    errors.push(`${where}: must be an object like { "exercise": "Deadlift", "sets": 3 }`)
    return null
  }
  checkFields(item, allowed, where, errors)

  const raw = typeof item.exercise === 'string' ? item.exercise.trim() : ''
  if (raw === '' || raw.length > 60) {
    errors.push(`${where}: "exercise" is required (an exercise name, max. 60 characters)`)
    return null
  }
  const label = `${where} (${quote(raw)})`
  let exercise = raw
  let category: Category | null = null

  const builtIn = BUILT_IN_EXERCISES.find((e) => e.name.toLowerCase() === raw.toLowerCase())
  if (builtIn) {
    exercise = builtIn.name // use the exact spelling of the library
    const given = item.category === undefined ? null : toCategory(item.category)
    if (item.category !== undefined && given !== builtIn.category) {
      errors.push(`${label}: is a built-in ${builtIn.category} exercise; remove "category"`)
    }
  } else {
    // A built-in name inside a longer name ("Wide Grip DB Bench Press") is a variation:
    // log it on the base exercise and put the difference in the note
    const base = BUILT_IN_EXERCISES.find((e) =>
      new RegExp(`(^|\\s)${escapeRegExp(e.name)}($|\\s)`, 'i').test(raw),
    )
    if (base) {
      const variation = raw.replace(new RegExp(escapeRegExp(base.name), 'i'), '').trim()
      errors.push(
        `${label}: looks like a variation of the built-in ${quote(base.name)}. ` +
          `Use "exercise": ${quote(base.name)} and "note": ${quote(variation.toLowerCase())}`,
      )
      return null
    }
    category = toCategory(item.category)
    if (!category) {
      errors.push(
        `${label}: is not a built-in exercise. To create it as a new exercise, add ` +
          `"category" (one of: ${CATEGORIES.join(', ')})`,
      )
      return null
    }
  }

  const sets = item.sets
  if (typeof sets !== 'number' || !Number.isInteger(sets) || sets < 1 || sets > MAX_SETS) {
    errors.push(`${label}: "sets" must be a whole number from 1 to ${MAX_SETS}`)
  }

  let note = ''
  if (item.note !== undefined) {
    if (typeof item.note === 'string' && item.note.length <= 200) note = item.note.trim()
    else errors.push(`${label}: "note" must be a text (max. 200 characters)`)
  }

  return {
    exercise,
    category,
    note,
    sets: typeof sets === 'number' ? sets : 1,
    reps: shortText(item.reps, 'reps', label, errors),
    weight: shortText(item.weight, 'weight', label, errors),
  }
}

// A main item: one exercise, or { "superset": [exercise, exercise, …] }.
// Both can have a "title", "time" and "cues".
function parseBlock(item: unknown, where: string, errors: string[]): Block | null {
  let exercises: Omit<MainExercise, 'index'>[]
  if (isObject(item) && 'superset' in item) {
    checkFields(item, ['superset', ...BLOCK_FIELDS], where, errors)
    if (!Array.isArray(item.superset) || item.superset.length < 2) {
      errors.push(`${where}: "superset" must be a list of at least two exercises`)
      return null
    }
    exercises = item.superset.flatMap(
      (x, j) => parseExercise(x, `${where}, superset exercise ${j + 1}`, EXERCISE_FIELDS, errors) ?? [],
    )
  } else {
    const single = parseExercise(item, where, [...EXERCISE_FIELDS, ...BLOCK_FIELDS], errors)
    if (!single) return null
    exercises = [single]
  }
  if (!isObject(item)) return null
  return {
    title: shortText(item.title, 'title', where, errors, 60),
    time: shortText(item.time, 'time', where, errors, 20),
    cues: textList(item.cues, 'cues', where, errors),
    exercises: exercises.map((e) => ({ ...e, index: -1 })), // numbered below
  }
}

// Checks one workout file. Returns the workout, or the list of problems.
export function parseWorkout(
  fileName: string,
  json: unknown,
): { workout: Workout; errors: [] } | { workout: null; errors: string[] } {
  const where = `workouts/${fileName}`
  const errors: string[] = []
  const slug = fileName.replace(/\.json$/, '')

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    errors.push(`${where}: file name must be lowercase letters, digits and dashes, e.g. "upper-a.json"`)
  }
  if (!isObject(json)) {
    return { workout: null, errors: [...errors, `${where}: must contain one workout object { ... }`] }
  }
  checkFields(json, WORKOUT_FIELDS, where, errors)

  let name = ''
  if (json.name !== undefined) {
    if (typeof json.name === 'string' && json.name.trim() !== '' && json.name.length <= 100) {
      name = json.name.trim()
    } else {
      errors.push(`${where}: "name" must be a text (max. 100 characters), or leave it out`)
    }
  }

  const category = WORKOUT_CATEGORIES.find((c) => c === json.category)
  if (!category) {
    errors.push(`${where}: "category" is required, one of: ${WORKOUT_CATEGORIES.join(', ')}`)
  }

  const blocks: Block[] = []
  if (!Array.isArray(json.main) || json.main.length === 0) {
    errors.push(`${where}: "main" is required: a list of at least one exercise or superset`)
  } else {
    json.main.forEach((item, i) => {
      const block = parseBlock(item, `${where}, main item ${i + 1}`, errors)
      if (block) blocks.push(block)
    })
  }

  // Number all main exercises in order; they are linked by this number
  const exercises = blocks.flatMap((b) => b.exercises)
  exercises.forEach((e, i) => (e.index = i))

  // Sets are saved per exercise and day, so an exercise can be in a workout only once
  const seen = new Set<string>()
  for (const e of exercises) {
    if (seen.has(e.exercise)) {
      errors.push(`${where}: ${quote(e.exercise)} appears twice; an exercise can only be logged once per day`)
    }
    seen.add(e.exercise)
  }

  const warmup = textList(json.warmup, 'warmup', where, errors)
  const finisher = textList(json.finisher, 'finisher', where, errors)

  if (errors.length > 0 || !category) return { workout: null, errors }
  return {
    workout: {
      slug,
      // Without a name: the main exercises, e.g. "BB Bench Press + Pull-Up"
      name: name || exercises.map((e) => e.exercise).join(' + '),
      category,
      warmup,
      blocks,
      exercises,
      finisher,
    },
    errors: [],
  }
}
