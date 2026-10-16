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
