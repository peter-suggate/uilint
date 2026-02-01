/**
 * Rule: no-unsafe-type-casts
 *
 * Detects and prevents unsafe type casting patterns in TypeScript that bypass
 * the type system, particularly:
 * - `as any` - Completely bypasses type checking
 * - `as unknown` - Casts to unknown without subsequent narrowing
 * - `as unknown as T` - Double-cast pattern used to force incompatible types
 *
 * Examples:
 * - Bad: const data = response as any;
 * - Bad: const user = input as unknown as User;
 * - Good: const user = UserSchema.parse(input);
 * - Good: if (isUser(data)) { // use data as User }
 */

import { createRule, defineRuleMeta } from "../utils/create-rule.js";
import type { TSESTree } from "@typescript-eslint/utils";

type MessageIds =
  | "noAsAny"
  | "noAsUnknown"
  | "noDoubleCast"
  | "noLegacyAsAny"
  | "noLegacyAsUnknown";

type Options = [
  {
    /** Report `as any` casts */
    reportAsAny?: boolean;
    /** Report `as unknown` casts */
    reportAsUnknown?: boolean;
    /** Report double-cast patterns like `as unknown as T` */
    reportDoubleCast?: boolean;
    /** Allow casts in test files (*.test.ts, *.spec.ts, __tests__/*) */
    allowInTestFiles?: boolean;
    /** Allow casts in catch blocks for error handling */
    allowInCatchBlocks?: boolean;
    /** Type names that are allowed as cast targets (e.g., ["HTMLElement", "Error"]) */
    allowedTypes?: string[];
  }
];

/**
 * Rule metadata - colocated with implementation for maintainability
 */
export const meta = defineRuleMeta({
  id: "no-unsafe-type-casts",
  version: "1.0.0",
  name: "No Unsafe Type Casts",
  description: "Disallow unsafe type casting patterns that bypass TypeScript's type system",
  defaultSeverity: "error",
  category: "static",
  icon: "🛡️",
  hint: "Prevents type system circumvention via casts",
  defaultEnabled: true,
  defaultOptions: [
    {
      reportAsAny: true,
      reportAsUnknown: false,
      reportDoubleCast: true,
      allowInTestFiles: true,
      allowInCatchBlocks: true,
      allowedTypes: [],
    },
  ],
  optionSchema: {
    fields: [
      {
        key: "reportAsAny",
        label: "Report 'as any' casts",
        type: "boolean",
        defaultValue: true,
        description: "Flag expressions like `value as any`",
      },
      {
        key: "reportAsUnknown",
        label: "Report 'as unknown' casts",
        type: "boolean",
        defaultValue: false,
        description: "Flag expressions like `value as unknown`",
      },
      {
        key: "reportDoubleCast",
        label: "Report double-cast patterns",
        type: "boolean",
        defaultValue: true,
        description: "Flag expressions like `value as unknown as Type`",
      },
      {
        key: "allowInTestFiles",
        label: "Allow in test files",
        type: "boolean",
        defaultValue: true,
        description: "Skip reporting in *.test.ts, *.spec.ts, and __tests__/* files",
      },
      {
        key: "allowInCatchBlocks",
        label: "Allow in catch blocks",
        type: "boolean",
        defaultValue: true,
        description: "Allow type casts inside catch blocks for error handling",
      },
      {
        key: "allowedTypes",
        label: "Allowed target types",
        type: "text",
        defaultValue: "",
        placeholder: "HTMLElement, Error, Event",
        description: "Comma-separated list of type names that are allowed as cast targets",
      },
    ],
  },
  docs: `
## What it does

Detects and prevents unsafe type casting patterns in TypeScript that bypass
the type system. These patterns can introduce runtime errors by lying to the
compiler about types.

### Detected Patterns

| Pattern | Risk | Description |
|---------|------|-------------|
| \`x as any\` | High | Completely disables type checking |
| \`x as unknown as T\` | High | Forces incompatible type conversion |
| \`x as unknown\` | Medium | Casts to unknown without narrowing |
| \`<any>x\` | High | Legacy syntax equivalent to \`as any\` |

## Why it's useful

- **Type Safety**: Catches type system circumvention that leads to runtime errors
- **Code Quality**: Encourages proper type guards and runtime validation
- **Maintainability**: Makes type assumptions explicit and verifiable
- **Refactoring**: Prevents hidden type mismatches that break during refactors

## Examples

### ❌ Incorrect

\`\`\`typescript
// Casting to any - bypasses all type checking
const data = response.data as any;
data.nonExistentMethod(); // No error, but crashes at runtime

// Double-cast pattern - forces incompatible types
const user = jsonData as unknown as User;
console.log(user.email); // Might be undefined!

// Legacy angle-bracket syntax
const element = <any>document.getElementById("app");
\`\`\`

### ✅ Correct

\`\`\`typescript
// Use runtime validation (Zod, io-ts, etc.)
const user = UserSchema.parse(jsonData);
console.log(user.email); // Type-safe!

// Use type guards
function isUser(data: unknown): data is User {
  return typeof data === "object" && data !== null && "email" in data;
}

if (isUser(jsonData)) {
  console.log(jsonData.email); // Narrowed to User
}

// Proper DOM type assertions (allowed by default)
const input = document.getElementById("email") as HTMLInputElement;

// Safe cast with validation
const error = err instanceof Error ? err : new Error(String(err));
\`\`\`

## Configuration

\`\`\`js
// eslint.config.js
"uilint/no-unsafe-type-casts": ["error", {
  reportAsAny: true,           // Flag 'as any' casts
  reportAsUnknown: false,      // Don't flag 'as unknown' alone
  reportDoubleCast: true,      // Flag 'as unknown as T' patterns
  allowInTestFiles: true,      // Allow in test files
  allowInCatchBlocks: true,    // Allow error handling casts
  allowedTypes: [              // Types that are safe to cast to
    "HTMLElement",
    "HTMLInputElement",
    "HTMLButtonElement",
    "Error",
    "Event"
  ]
}]
\`\`\`

## Allowed Type Exceptions

You can configure specific types that are allowed as cast targets. This is useful for:

- **DOM elements**: \`HTMLElement\`, \`HTMLInputElement\`, etc.
- **Error handling**: \`Error\`, \`TypeError\`, etc.
- **Event handling**: \`Event\`, \`MouseEvent\`, \`KeyboardEvent\`, etc.
- **Third-party types**: Types from libraries that require casting

## When to Disable

Consider disabling this rule when:

- Working with legacy code that requires extensive type casting
- Integrating with untyped JavaScript libraries
- Writing type-level tests or type utilities

Use inline comments for specific exceptions:

\`\`\`typescript
// eslint-disable-next-line uilint/no-unsafe-type-casts
const data = legacyApiResponse as any;
\`\`\`
`,
});

/**
 * Check if the current file is a test file
 */
function isTestFile(filename: string): boolean {
  return (
    filename.includes(".test.") ||
    filename.includes(".spec.") ||
    filename.includes("__tests__") ||
    filename.includes("__mocks__")
  );
}

/**
 * Check if a node is inside a catch block
 */
function isInsideCatchBlock(node: TSESTree.Node): boolean {
  let current: TSESTree.Node | undefined = node.parent;
  while (current) {
    if (current.type === "CatchClause") {
      return true;
    }
    current = current.parent;
  }
  return false;
}

/**
 * Get the type name from a type annotation node
 */
function getTypeName(typeAnnotation: TSESTree.TypeNode): string | null {
  switch (typeAnnotation.type) {
    case "TSTypeReference":
      if (typeAnnotation.typeName.type === "Identifier") {
        return typeAnnotation.typeName.name;
      }
      // Handle qualified names like React.FC
      if (typeAnnotation.typeName.type === "TSQualifiedName") {
        return `${getQualifiedName(typeAnnotation.typeName)}`;
      }
      return null;

    case "TSAnyKeyword":
      return "any";

    case "TSUnknownKeyword":
      return "unknown";

    default:
      return null;
  }
}

/**
 * Get the full qualified name (e.g., "React.FC")
 */
function getQualifiedName(node: TSESTree.TSQualifiedName): string {
  const left =
    node.left.type === "Identifier"
      ? node.left.name
      : getQualifiedName(node.left);
  return `${left}.${node.right.name}`;
}

/**
 * Check if a type is in the allowed list
 */
function isAllowedType(
  typeAnnotation: TSESTree.TypeNode,
  allowedTypes: string[]
): boolean {
  const typeName = getTypeName(typeAnnotation);
  if (!typeName) return false;
  return allowedTypes.includes(typeName);
}

/**
 * Check if this is a double-cast pattern: `expr as unknown as T` or `expr as any as T`
 */
function isDoubleCastPattern(node: TSESTree.TSAsExpression): boolean {
  // The expression being cast must also be a TSAsExpression
  if (node.expression.type !== "TSAsExpression") {
    return false;
  }

  const innerCast = node.expression;
  const innerType = innerCast.typeAnnotation;

  // Check if the inner cast is to `unknown` or `any`
  return (
    innerType.type === "TSUnknownKeyword" || innerType.type === "TSAnyKeyword"
  );
}

/**
 * Check if this is a double-cast pattern using legacy syntax: `<T><unknown>expr`
 */
function isLegacyDoubleCastPattern(node: TSESTree.TSTypeAssertion): boolean {
  // The expression being cast must also be a TSTypeAssertion
  if (node.expression.type !== "TSTypeAssertion") {
    return false;
  }

  const innerCast = node.expression;
  const innerType = innerCast.typeAnnotation;

  // Check if the inner cast is to `unknown` or `any`
  return (
    innerType.type === "TSUnknownKeyword" || innerType.type === "TSAnyKeyword"
  );
}

export default createRule<Options, MessageIds>({
  name: "no-unsafe-type-casts",
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow unsafe type casting patterns that bypass TypeScript's type system",
    },
    messages: {
      noAsAny:
        "Avoid using 'as any'. This completely bypasses type checking. Use proper typing, type guards, or runtime validation instead.",
      noAsUnknown:
        "Casting to 'unknown' without subsequent type narrowing bypasses type safety. Use type guards or validation.",
      noDoubleCast:
        "Double-cast pattern ('as unknown as {{targetType}}') bypasses type checking. Use runtime validation or type guards instead.",
      noLegacyAsAny:
        "Avoid using '<any>' type assertion. This completely bypasses type checking. Use proper typing or type guards instead.",
      noLegacyAsUnknown:
        "Casting to '<unknown>' without subsequent type narrowing bypasses type safety. Use type guards or validation.",
    },
    schema: [
      {
        type: "object",
        properties: {
          reportAsAny: {
            type: "boolean",
            description: "Report 'as any' casts",
          },
          reportAsUnknown: {
            type: "boolean",
            description: "Report 'as unknown' casts",
          },
          reportDoubleCast: {
            type: "boolean",
            description: "Report double-cast patterns like 'as unknown as T'",
          },
          allowInTestFiles: {
            type: "boolean",
            description: "Allow casts in test files",
          },
          allowInCatchBlocks: {
            type: "boolean",
            description: "Allow casts in catch blocks for error handling",
          },
          allowedTypes: {
            type: "array",
            items: { type: "string" },
            description: "Type names that are allowed as cast targets",
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [
    {
      reportAsAny: true,
      reportAsUnknown: false,
      reportDoubleCast: true,
      allowInTestFiles: true,
      allowInCatchBlocks: true,
      allowedTypes: [],
    },
  ],
  create(context) {
    const options = context.options[0] || {};
    const reportAsAny = options.reportAsAny ?? true;
    const reportAsUnknown = options.reportAsUnknown ?? false;
    const reportDoubleCast = options.reportDoubleCast ?? true;
    const allowInTestFiles = options.allowInTestFiles ?? true;
    const allowInCatchBlocks = options.allowInCatchBlocks ?? true;
    const allowedTypes = options.allowedTypes ?? [];

    // Skip test files if configured
    const filename = context.filename || context.getFilename();
    if (allowInTestFiles && isTestFile(filename)) {
      return {};
    }

    /**
     * Check TSAsExpression nodes (modern `as` syntax)
     */
    function checkAsExpression(node: TSESTree.TSAsExpression): void {
      const targetType = node.typeAnnotation;

      // Skip if in catch block and allowed
      if (allowInCatchBlocks && isInsideCatchBlock(node)) {
        return;
      }

      // Check for double-cast pattern first (highest priority)
      if (reportDoubleCast && isDoubleCastPattern(node)) {
        const targetTypeName = getTypeName(targetType) || "Type";
        context.report({
          node,
          messageId: "noDoubleCast",
          data: { targetType: targetTypeName },
        });
        return; // Don't report other errors for the same node
      }

      // Check if the target type is in the allowed list
      if (isAllowedType(targetType, allowedTypes)) {
        return;
      }

      // Check for `as any`
      if (reportAsAny && targetType.type === "TSAnyKeyword") {
        context.report({
          node,
          messageId: "noAsAny",
        });
        return;
      }

      // Check for `as unknown`
      if (reportAsUnknown && targetType.type === "TSUnknownKeyword") {
        context.report({
          node,
          messageId: "noAsUnknown",
        });
        return;
      }
    }

    /**
     * Check TSTypeAssertion nodes (legacy `<Type>` syntax)
     */
    function checkTypeAssertion(node: TSESTree.TSTypeAssertion): void {
      const targetType = node.typeAnnotation;

      // Skip if in catch block and allowed
      if (allowInCatchBlocks && isInsideCatchBlock(node)) {
        return;
      }

      // Check for legacy double-cast pattern
      if (reportDoubleCast && isLegacyDoubleCastPattern(node)) {
        const targetTypeName = getTypeName(targetType) || "Type";
        context.report({
          node,
          messageId: "noDoubleCast",
          data: { targetType: targetTypeName },
        });
        return;
      }

      // Check if the target type is in the allowed list
      if (isAllowedType(targetType, allowedTypes)) {
        return;
      }

      // Check for `<any>`
      if (reportAsAny && targetType.type === "TSAnyKeyword") {
        context.report({
          node,
          messageId: "noLegacyAsAny",
        });
        return;
      }

      // Check for `<unknown>`
      if (reportAsUnknown && targetType.type === "TSUnknownKeyword") {
        context.report({
          node,
          messageId: "noLegacyAsUnknown",
        });
        return;
      }
    }

    return {
      TSAsExpression: checkAsExpression,
      TSTypeAssertion: checkTypeAssertion,
    };
  },
});
