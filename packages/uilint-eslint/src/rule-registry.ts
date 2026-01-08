/**
 * Rule Registry
 *
 * Central registry of all UILint ESLint rules with metadata for CLI tooling.
 * This allows the installer to auto-discover available rules and present them
 * to the user with descriptions.
 */

export interface RuleMetadata {
  /** Rule identifier (e.g., "no-arbitrary-tailwind") */
  id: string;
  /** Display name for CLI */
  name: string;
  /** Short description for CLI selection prompts */
  description: string;
  /** Default severity level */
  defaultSeverity: "error" | "warn" | "off";
  /** Default options for the rule */
  defaultOptions?: unknown[];
  /** Whether this rule requires a styleguide file */
  requiresStyleguide?: boolean;
  /** Category for grouping */
  category: "static" | "semantic";
}

/**
 * Registry of all available UILint ESLint rules
 *
 * When adding a new rule:
 * 1. Add the rule implementation to src/rules/
 * 2. Add an entry here with metadata
 * 3. Export the rule from src/index.ts
 * 4. The CLI installer will automatically discover and offer it
 */
export const ruleRegistry: RuleMetadata[] = [
  {
    id: "no-arbitrary-tailwind",
    name: "No Arbitrary Tailwind",
    description: "Forbid arbitrary values like w-[123px], bg-[#fff]",
    defaultSeverity: "error",
    category: "static",
  },
  {
    id: "consistent-spacing",
    name: "Consistent Spacing",
    description: "Enforce spacing scale (no magic numbers in gap/padding)",
    defaultSeverity: "warn",
    defaultOptions: [{ scale: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16] }],
    category: "static",
  },
  {
    id: "consistent-dark-mode",
    name: "Consistent Dark Mode",
    description:
      "Ensure consistent dark: theming (error on mix, warn on missing)",
    defaultSeverity: "error",
    defaultOptions: [{ warnOnMissingDarkMode: true }],
    category: "static",
  },
  {
    id: "no-direct-store-import",
    name: "No Direct Store Import",
    description: "Forbid direct Zustand store imports (use context hooks)",
    defaultSeverity: "warn",
    defaultOptions: [{ storePattern: "use*Store" }],
    category: "static",
  },
  {
    id: "no-mixed-component-libraries",
    name: "No Mixed Component Libraries",
    description: "Forbid mixing component libraries (e.g., shadcn + MUI)",
    defaultSeverity: "error",
    defaultOptions: [{ libraries: ["shadcn", "mui"] }],
    category: "static",
  },
  {
    id: "semantic",
    name: "Semantic Analysis",
    description: "LLM-powered semantic UI analysis using your styleguide",
    defaultSeverity: "warn",
    defaultOptions: [
      { model: "qwen3-coder:30b", styleguidePath: ".uilint/styleguide.md" },
    ],
    requiresStyleguide: true,
    category: "semantic",
  },
];

/**
 * Get rule metadata by ID
 */
export function getRuleMetadata(id: string): RuleMetadata | undefined {
  return ruleRegistry.find((rule) => rule.id === id);
}

/**
 * Get all rules in a category
 */
export function getRulesByCategory(
  category: "static" | "semantic"
): RuleMetadata[] {
  return ruleRegistry.filter((rule) => rule.category === category);
}
