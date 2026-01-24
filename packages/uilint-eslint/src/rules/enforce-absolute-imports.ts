/**
 * Rule: enforce-absolute-imports
 *
 * Requires alias imports (e.g., @/) for imports that traverse more than a
 * configurable number of directory levels. Prevents fragile relative import
 * paths like ../../../utils/helper.
 *
 * Examples:
 * - Bad: import { x } from '../../utils/helper'
 * - Good: import { x } from '@/utils/helper'
 */

import { createRule, defineRuleMeta } from "../utils/create-rule.js";
import type { TSESTree } from "@typescript-eslint/utils";

type MessageIds = "preferAbsoluteImport";
type Options = [
  {
    /** Maximum allowed parent directory traversals (default: 1, allows ../ but not ../../) */
    maxRelativeDepth?: number;
    /** The alias prefix to suggest (default: "@/") */
    aliasPrefix?: string;
    /** Patterns to ignore (e.g., ["node_modules", ".css"]) */
    ignorePaths?: string[];
  }
];

/**
 * Rule metadata - colocated with implementation for maintainability
 */
export const meta = defineRuleMeta({
  id: "enforce-absolute-imports",
  version: "1.0.0",
  name: "Enforce Absolute Imports",
  description:
    "Require alias imports for paths beyond a configurable directory depth",
  defaultSeverity: "warn",
  category: "static",
  icon: "📦",
  hint: "Prevents deep relative imports",
  defaultEnabled: true,
  defaultOptions: [{ maxRelativeDepth: 1, aliasPrefix: "@/" }],
  optionSchema: {
    fields: [
      {
        key: "maxRelativeDepth",
        label: "Maximum relative depth",
        type: "number",
        defaultValue: 1,
        description:
          "Maximum number of parent directory traversals allowed (../ counts as 1)",
      },
      {
        key: "aliasPrefix",
        label: "Alias prefix",
        type: "text",
        defaultValue: "@/",
        description: "The path alias prefix to use (e.g., @/, ~/)",
      },
    ],
  },
  docs: `
## What it does

Enforces the use of path aliases (like \`@/\`) for imports that traverse multiple
parent directories. This prevents fragile relative imports that are hard to
maintain and refactor.

## Why it's useful

- **Maintainability**: Absolute imports don't break when files move
- **Readability**: Clear indication of where imports come from
- **Consistency**: Standardizes import style across the codebase
- **Refactoring**: Easier to move files without updating import paths

## Examples

### ❌ Incorrect (with maxRelativeDepth: 1)

\`\`\`tsx
// Too many parent traversals
import { Button } from '../../components/Button';
import { utils } from '../../../lib/utils';
\`\`\`

### ✅ Correct

\`\`\`tsx
// Using alias imports
import { Button } from '@/components/Button';
import { utils } from '@/lib/utils';

// Single parent traversal (within threshold)
import { sibling } from '../sibling';
import { local } from './local';
\`\`\`

## Configuration

\`\`\`js
// eslint.config.js
"uilint/enforce-absolute-imports": ["warn", {
  maxRelativeDepth: 1,  // Allow ../ but not ../../
  aliasPrefix: "@/",    // Suggested alias prefix
  ignorePaths: [".css", ".scss", "node_modules"]
}]
\`\`\`
`,
});

/**
 * Count the number of parent directory traversals in an import path
 */
function countParentTraversals(importSource: string): number {
  // Match all occurrences of ../ or ..\\ (Windows)
  const matches = importSource.match(/\.\.\//g);
  return matches ? matches.length : 0;
}

/**
 * Check if an import is a relative path
 */
function isRelativeImport(importSource: string): boolean {
  return importSource.startsWith("./") || importSource.startsWith("../");
}

/**
 * Check if the import should be ignored
 */
function shouldIgnore(importSource: string, ignorePaths: string[]): boolean {
  return ignorePaths.some((pattern) => importSource.includes(pattern));
}

export default createRule<Options, MessageIds>({
  name: "enforce-absolute-imports",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require alias imports for paths beyond a configurable directory depth",
    },
    messages: {
      preferAbsoluteImport:
        "Import traverses {{depth}} parent director{{plural}}. Use an alias like '{{aliasPrefix}}...' instead of '{{importSource}}'.",
    },
    schema: [
      {
        type: "object",
        properties: {
          maxRelativeDepth: {
            type: "number",
            minimum: 0,
            description:
              "Maximum number of parent directory traversals allowed",
          },
          aliasPrefix: {
            type: "string",
            description: "The path alias prefix to suggest",
          },
          ignorePaths: {
            type: "array",
            items: { type: "string" },
            description: "Patterns to ignore",
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [
    {
      maxRelativeDepth: 1,
      aliasPrefix: "@/",
      ignorePaths: [],
    },
  ],
  create(context) {
    const options = context.options[0] || {};
    const maxRelativeDepth = options.maxRelativeDepth ?? 1;
    const aliasPrefix = options.aliasPrefix ?? "@/";
    const ignorePaths = options.ignorePaths ?? [];

    /**
     * Check an import source and report if it exceeds the depth threshold
     */
    function checkImportSource(
      source: string,
      node: TSESTree.StringLiteral
    ): void {
      // Skip non-relative imports (node_modules, aliases, etc.)
      if (!isRelativeImport(source)) {
        return;
      }

      // Skip ignored paths
      if (shouldIgnore(source, ignorePaths)) {
        return;
      }

      const depth = countParentTraversals(source);

      if (depth > maxRelativeDepth) {
        context.report({
          node,
          messageId: "preferAbsoluteImport",
          data: {
            depth: String(depth),
            plural: depth === 1 ? "y" : "ies",
            aliasPrefix,
            importSource: source,
          },
        });
      }
    }

    return {
      // Standard import declarations: import { x } from '../../utils'
      ImportDeclaration(node) {
        const source = node.source.value as string;
        checkImportSource(source, node.source);
      },

      // Re-exports with source: export { x } from '../../utils'
      ExportNamedDeclaration(node) {
        if (node.source) {
          const source = node.source.value as string;
          checkImportSource(source, node.source);
        }
      },

      // Export all: export * from '../../utils'
      ExportAllDeclaration(node) {
        const source = node.source.value as string;
        checkImportSource(source, node.source);
      },
    };
  },
});
