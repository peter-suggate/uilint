/**
 * Rule: no-direct-store-import
 *
 * Forbids direct Zustand store imports - prefer using hooks via context.
 */

import { createRule, defineRuleMeta } from "../utils/create-rule.js";

type MessageIds = "noDirectImport";
type Options = [
  {
    storePattern?: string;
  }
];

/**
 * Rule metadata - colocated with implementation for maintainability
 */
export const meta = defineRuleMeta({
  id: "no-direct-store-import",
  name: "No Direct Store Import",
  description: "Forbid direct Zustand store imports (use context hooks)",
  defaultSeverity: "warn",
  category: "static",
  icon: "🏪",
  hint: "Encourages testable store access",
  defaultEnabled: true,
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
  docs: `
## What it does

Prevents direct imports of Zustand stores, encouraging the use of context-based hooks
for better dependency injection and testability.

## Why it's useful

- **Testability**: Context-based access allows easy mocking in tests
- **Flexibility**: Store implementation can change without updating all consumers
- **Dependency Injection**: Stores can be provided at different levels of the component tree
- **Server Components**: Helps avoid accidentally importing stores in server components

## Examples

### ❌ Incorrect

\`\`\`tsx
// Directly importing the store
import { useAuthStore } from '../stores/auth-store';
import { useCartStore } from '@/stores/useCartStore';

function MyComponent() {
  const user = useAuthStore((s) => s.user);
}
\`\`\`

### ✅ Correct

\`\`\`tsx
// Using context-provided hooks
import { useAuth } from '../contexts/auth-context';
import { useCart } from '@/hooks/useCart';

function MyComponent() {
  const { user } = useAuth();
}
\`\`\`

## Configuration

\`\`\`js
// eslint.config.js
"uilint/no-direct-store-import": ["warn", {
  storePattern: "use*Store"  // Pattern to match store names
}]
\`\`\`

## Notes

- The pattern uses glob syntax (\`*\` matches any characters)
- Only triggers for imports from paths containing "store"
- Works with both named and default imports
`,
});

// Convert glob pattern to regex
function patternToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`);
}

export default createRule<Options, MessageIds>({
  name: "no-direct-store-import",
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid direct Zustand store imports (use hooks via context)",
    },
    messages: {
      noDirectImport:
        "Avoid importing store '{{name}}' directly. Use the store via a context hook instead.",
    },
    schema: [
      {
        type: "object",
        properties: {
          storePattern: {
            type: "string",
            description: "Glob pattern for store names",
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [{ storePattern: "use*Store" }],
  create(context) {
    const options = context.options[0] || {};
    const pattern = options.storePattern || "use*Store";
    const regex = patternToRegex(pattern);

    return {
      ImportDeclaration(node) {
        // Check if importing from a store file
        const source = node.source.value as string;
        if (!source.includes("store")) return;

        // Check imported specifiers
        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportSpecifier") {
            const importedName =
              specifier.imported.type === "Identifier"
                ? specifier.imported.name
                : specifier.imported.value;

            if (regex.test(importedName)) {
              context.report({
                node: specifier,
                messageId: "noDirectImport",
                data: { name: importedName },
              });
            }
          }

          if (specifier.type === "ImportDefaultSpecifier") {
            const localName = specifier.local.name;
            if (regex.test(localName)) {
              context.report({
                node: specifier,
                messageId: "noDirectImport",
                data: { name: localName },
              });
            }
          }
        }
      },
    };
  },
});
