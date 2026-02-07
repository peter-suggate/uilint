/**
 * Category Registry
 *
 * Centralized metadata for rule categories.
 * Used by CLI installers and UI components to display category information
 * without hardcoding assumptions.
 */

/**
 * Metadata for a rule category
 */
export interface CategoryMeta {
  /** Category identifier */
  id: string;
  /** Display name */
  name: string;
  /** Short description */
  description: string;
  /** Icon for display (emoji) */
  icon: string;
  /** Whether rules in this category are enabled by default during install */
  defaultEnabled: boolean;
}

/**
 * Registry of all rule categories
 */
export const categoryRegistry: CategoryMeta[] = [
  {
    id: "static",
    name: "Static Rules",
    description: "Pattern-based, fast analysis",
    icon: "\u{1F4CB}",
    defaultEnabled: true,
  },
  {
    id: "semantic",
    name: "Semantic Rules",
    description: "LLM-powered analysis",
    icon: "\u{1F9E0}",
    defaultEnabled: false,
  },
];

/**
 * Get metadata for a specific category
 */
export function getCategoryMeta(id: string): CategoryMeta | undefined {
  return categoryRegistry.find((cat) => cat.id === id);
}

/**
 * Register a new category from a plugin package.
 * Idempotent: silently skips if a category with the same id already exists.
 */
export function registerCategory(meta: CategoryMeta): void {
  const existing = categoryRegistry.find((c) => c.id === meta.id);
  if (existing) return;
  categoryRegistry.push(meta);
}
