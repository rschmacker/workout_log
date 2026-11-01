import { myEntries } from './entries'
import { localData, useLocalData } from './localData'
import { mySets } from './sets'
import { supabase } from './supabase'

// Shared types for exercises. The categories and their order match the
// check constraint in supabase/schema.sql.
export const CATEGORIES = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'] as const

export type Category = (typeof CATEGORIES)[number]

export type Exercise = {
  id: string
  user_id: string | null // null = built-in exercise
  name: string
  category: Category
}

// Name shown in the app (the database stores "Back")
export function categoryLabel(category: Category): string {
  return category === 'Back' ? 'Back/Hinge' : category
}

// For URLs: "Chest" <-> "chest"
export function categorySlug(category: Category): string {
  return category.toLowerCase()
}

export function categoryFromSlug(slug: string | undefined): Category | null {
  return CATEGORIES.find((c) => categorySlug(c) === slug) ?? null
}

const COLUMNS = 'id, user_id, name, category'
const byName = (a: Exercise, b: Exercise) => a.name.localeCompare(b.name)

// All exercises (built-in and everyone's custom ones), sorted by name,
// with a copy on this phone (see localData.ts)
export const exerciseList = localData('exercises', async () => {
  const { data, error } = await supabase.from('exercises').select(COLUMNS)
  if (error) throw error
  return (data as Exercise[]).sort(byName)
})
export const useExercises = () => useLocalData(exerciseList)

// Adds a custom exercise (user_id is filled in by the database).
// Throws on error; code 23505 = an exercise with this name already exists.
export async function addExercise(name: string, category: Category): Promise<Exercise> {
  const { data, error } = await supabase
    .from('exercises')
    .insert({ name: name.trim(), category })
    .select(COLUMNS)
    .single()
  if (error) throw error
  const exercise = data as Exercise
  exerciseList.change((list) => [...list, exercise].sort(byName))
  return exercise
}

// Renames one of your custom exercises. Throws on error (23505 as above).
export async function renameExercise(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('exercises').update({ name: name.trim() }).eq('id', id)
  if (error) throw error
  exerciseList.change((list) =>
    list.map((e) => (e.id === id ? { ...e, name: name.trim() } : e)).sort(byName),
  )
}

// Deletes one of your custom exercises. The database also deletes your sets and
// notes of it (on delete cascade). Throws on error.
export async function deleteExercise(id: string): Promise<void> {
  const { error } = await supabase.from('exercises').delete().eq('id', id)
  if (error) throw error
  exerciseList.change((list) => list.filter((e) => e.id !== id))
  mySets.change((all) => all.filter((s) => s.exercise_id !== id))
  myEntries.change((all) => all.filter((e) => e.exercise_id !== id))
}
