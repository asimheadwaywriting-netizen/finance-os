// Category taxonomy + design tokens. Owned by Claude Code (see CLAUDE.md ownership rules).
// Source of truth for the taxonomy: CLAUDE.md "Category Taxonomy" section.

export type TransactionType = 'Income' | 'Expense'

export interface CategoryDef {
  name: string
  type: TransactionType
  color: string
}

export const CATEGORY_LIST: CategoryDef[] = [
  // Expense categories
  { name: 'Groceries', type: 'Expense', color: '#f97316' }, // orange-500
  { name: 'Food & Dining', type: 'Expense', color: '#fb923c' }, // orange-400
  { name: 'Bills & Utilities', type: 'Expense', color: '#3b82f6' }, // blue-500
  { name: 'Rent / Housing', type: 'Expense', color: '#60a5fa' }, // blue-400
  { name: 'Transportation', type: 'Expense', color: '#a78bfa' }, // violet-400
  { name: 'Home Repair', type: 'Expense', color: '#f59e0b' }, // amber-500
  { name: 'Health & Medical', type: 'Expense', color: '#ef4444' }, // red-500
  { name: 'Date Night / Entertainment', type: 'Expense', color: '#ec4899' }, // pink-500
  { name: 'Shopping & Personal', type: 'Expense', color: '#06b6d4' }, // cyan-500
  { name: 'Education', type: 'Expense', color: '#8b5cf6' }, // violet-500
  { name: 'Family & Gifts', type: 'Expense', color: '#14b8a6' }, // teal-500
  { name: 'Subscriptions', type: 'Expense', color: '#6366f1' }, // indigo-500
  { name: 'Savings & Investments', type: 'Expense', color: '#10b981' }, // emerald-500
  { name: 'Debt Payment', type: 'Expense', color: '#dc2626' }, // red-600
  { name: 'Miscellaneous', type: 'Expense', color: '#6b7280' }, // gray-500
  // Income categories
  { name: 'Salary', type: 'Income', color: '#3b82f6' }, // blue-500
  { name: 'Freelance Income', type: 'Income', color: '#0ea5e9' }, // sky-500
  { name: 'Other Income', type: 'Income', color: '#10b981' }, // emerald-500
]

/** Lookup map: category name → hex color. */
export const CATEGORY_COLORS: Record<string, string> = Object.fromEntries(
  CATEGORY_LIST.map((c) => [c.name, c.color])
)

/** Categories for a given transaction type (TransactionForm dropdown filter). */
export function categoriesForType(type: TransactionType): CategoryDef[] {
  return CATEGORY_LIST.filter((c) => c.type === type)
}

// Design system tokens (mirrored in tailwind.config.ts `brand` colors)
export const COLORS = {
  bg: '#0b0f17',
  income: '#3b82f6', // blue-500
  expense: '#f97316', // orange-500
  warning: '#f59e0b', // amber-500
  neutral: '#6b7280', // gray-500
  success: '#10b981', // emerald-500
} as const

/** Budget warning threshold — Gmail alert + UI warning at ≥80% of category budget. */
export const BUDGET_WARNING_THRESHOLD = 0.8
