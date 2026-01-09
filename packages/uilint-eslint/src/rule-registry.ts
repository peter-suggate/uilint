/**
 * Rule Registry
 *
 * Central registry of all UILint ESLint rules with metadata for CLI tooling.
 * This allows the installer to auto-discover available rules and present them
 * to the user with descriptions.
 */

/**
 * Schema for prompting user to configure a rule option
 */
export interface OptionFieldSchema {
  /** Field name in the options object */
  key: string;
  /** Display label for the prompt */
  label: string;
  /** Prompt type */
  type: "text" | "number" | "boolean" | "select" | "multiselect";
  /** Default value */
  defaultValue: unknown;
  /** Placeholder text (for text/number inputs) */
  placeholder?: string;
  /** Options for select/multiselect */
  options?: Array<{ value: string | number; label: string }>;
  /** Description/hint for the field */
  description?: string;
}

/**
 * Schema describing how to prompt for rule options during installation
 */
export interface RuleOptionSchema {
  /** Fields that can be configured for this rule */
  fields: OptionFieldSchema[];
}

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
  /** Schema for prompting user to configure options during install */
  optionSchema?: RuleOptionSchema;
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
    optionSchema: {
      fields: [
        {
          key: "scale",
          label: "Allowed spacing values",
          type: "text",
          defaultValue: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16],
          placeholder: "0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16",
          description: "Comma-separated list of allowed spacing values",
        },
      ],
    },
    category: "static",
  },
  {
    id: "consistent-dark-mode",
    name: "Consistent Dark Mode",
    description:
      "Ensure consistent dark: theming (error on mix, warn on missing)",
    defaultSeverity: "error",
    defaultOptions: [{ warnOnMissingDarkMode: true }],
    optionSchema: {
      fields: [
        {
          key: "warnOnMissingDarkMode",
          label: "Warn when elements lack dark: variant",
          type: "boolean",
          defaultValue: true,
          description:
            "Enable warnings for elements missing dark mode variants",
        },
      ],
    },
    category: "static",
  },
  {
    id: "no-direct-store-import",
    name: "No Direct Store Import",
    description: "Forbid direct Zustand store imports (use context hooks)",
    defaultSeverity: "warn",
    defaultOptions: [{ storePattern: "use*Store" }],
    optionSchema: {
      fields: [
        {
          key: "storePattern",
          label: "Glob pattern for store files",
          type: "text",
          defaultValue: "use*Store",
          placeholder: "use*Store",
          description: "Pattern to match store file names",
        },
      ],
    },
    category: "static",
  },
  {
    id: "prefer-zustand-state-management",
    name: "Prefer Zustand State Management",
    description:
      "Detect excessive useState/useReducer/useContext; suggest Zustand",
    defaultSeverity: "warn",
    defaultOptions: [
      {
        maxStateHooks: 3,
        countUseState: true,
        countUseReducer: true,
        countUseContext: true,
      },
    ],
    optionSchema: {
      fields: [
        {
          key: "maxStateHooks",
          label: "Max state hooks before warning",
          type: "number",
          defaultValue: 3,
          placeholder: "3",
          description: "Maximum number of state hooks allowed before warning",
        },
        {
          key: "countUseState",
          label: "Count useState hooks",
          type: "boolean",
          defaultValue: true,
        },
        {
          key: "countUseReducer",
          label: "Count useReducer hooks",
          type: "boolean",
          defaultValue: true,
        },
        {
          key: "countUseContext",
          label: "Count useContext hooks",
          type: "boolean",
          defaultValue: true,
        },
      ],
    },
    category: "static",
  },
  {
    id: "no-mixed-component-libraries",
    name: "No Mixed Component Libraries",
    description: "Forbid mixing component libraries (e.g., shadcn + MUI)",
    defaultSeverity: "error",
    defaultOptions: [{ libraries: ["shadcn", "mui"] }],
    optionSchema: {
      fields: [
        {
          key: "preferred",
          label: "Preferred component library",
          type: "select",
          defaultValue: "shadcn",
          options: [
            { value: "shadcn", label: "shadcn/ui" },
            { value: "mui", label: "MUI (Material-UI)" },
          ],
          description:
            "The preferred UI library. Components from other libraries will be flagged.",
        },
      ],
    },
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
    optionSchema: {
      fields: [
        {
          key: "model",
          label: "Ollama model to use",
          type: "text",
          defaultValue: "qwen3-coder:30b",
          placeholder: "qwen3-coder:30b",
          description: "The Ollama model name for semantic analysis",
        },
        {
          key: "styleguidePath",
          label: "Path to styleguide file",
          type: "text",
          defaultValue: ".uilint/styleguide.md",
          placeholder: ".uilint/styleguide.md",
          description: "Relative path to the styleguide markdown file",
        },
      ],
    },
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
