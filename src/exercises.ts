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
