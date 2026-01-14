---
name: ui-consistency-enforcer
description: |
  When the user asks you to update React UI code in ways that suggest they want
  consistency with existing project patterns, style guides, or design systems,
  this skill helps you create a bulletproof ESLint rule to enforce that pattern
  permanently. Trigger keywords: "make consistent", "match the style", "follow
  the pattern", "like the other components", "according to our design system",
  "enforce across the codebase", "prevent this in the future".
license: MIT
metadata:
  author: uilint
  version: "1.0.0"
  category: react-eslint
compatibility: |
  Requires Node.js 20+, TypeScript project with @typescript-eslint/utils,
  and uilint-eslint package installed.
---

# UI Consistency Enforcer Skill

You are an expert at writing bulletproof ESLint rules for React/TypeScript projects
using the @typescript-eslint framework. When the user asks you to update UI code in
a way that suggests they want consistency with existing patterns, you should:

1. **Identify the consistency pattern** the user wants to enforce
2. **Create an ESLint rule** that will catch future violations
3. **Write comprehensive tests** for the rule
4. **Register the rule** in the uilint-eslint package

## When to Activate

Activate this skill when the user's request matches patterns like:

- "Update this component to use our Button instead of native button"
- "Make sure all forms use our design system components"
- "This should match the pattern in our other components"
- "Enforce that we always use X instead of Y"
- "Create a lint rule to prevent this"
- "Make this consistent with our style guide"
- Refactoring multiple components to follow a pattern
- Adding design system enforcement

## Step-by-Step Process

### Step 1: Understand the Pattern

Before writing the rule, understand:

1. **What pattern should be enforced?** (e.g., "use shadcn Button instead of native button")
2. **Where does it apply?** (all files? only components? specific directories?)
3. **What are the exceptions?** (tests? internal utilities? specific files?)
4. **What's the fix?** (what should developers do instead?)

Ask clarifying questions if needed before proceeding.

### Step 2: Analyze Existing Rules

Look at the existing uilint-eslint rules for patterns:

```bash
ls packages/uilint-eslint/src/rules/
```

Read similar rules to understand the codebase patterns:
- `prefer-zustand-state-management.ts` - component analysis, hook counting
- `no-mixed-component-libraries.ts` - cross-file analysis, import tracking
- `consistent-spacing.ts` - className/Tailwind pattern matching
- `consistent-dark-mode.ts` - attribute analysis in JSX

### Step 3: Write the Rule

Create the rule file at `packages/uilint-eslint/src/rules/{rule-name}.ts`.

Follow this structure exactly:

```typescript
/**
 * Rule: {rule-name}
 *
 * {Description of what this rule does and why}
 */

import { createRule } from "../utils/create-rule.js";
import type { TSESTree } from "@typescript-eslint/utils";

type MessageIds = "{messageId1}" | "{messageId2}";
type Options = [
  {
    /** Option description */
    optionName?: optionType;
  }?
];

export default createRule<Options, MessageIds>({
  name: "{rule-name}",
  meta: {
    type: "problem" | "suggestion" | "layout",
    docs: {
      description: "{Human-readable description}",
    },
    messages: {
      messageId1: "{Error message with {{placeholders}}}",
      messageId2: "{Another message}",
    },
    schema: [
      {
        type: "object",
        properties: {
          optionName: {
            type: "string",
            description: "Option description",
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [{ optionName: "default" }],
  create(context) {
    const options = context.options[0] || {};
    // Use options with defaults
    const optionName = options.optionName ?? "default";

    return {
      // AST visitor methods
      JSXOpeningElement(node) {
        // Analyze JSX elements
      },
      ImportDeclaration(node) {
        // Track imports
      },
      CallExpression(node) {
        // Analyze function calls like hooks
      },
      "Program:exit"() {
        // Final analysis after parsing entire file
      },
    };
  },
});
```

### Step 4: Write Comprehensive Tests

Create the test file at `packages/uilint-eslint/src/rules/{rule-name}.test.ts`.

Follow this structure:

```typescript
/**
 * Tests for: {rule-name}
 *
 * {Description}
 */

import { RuleTester } from "@typescript-eslint/rule-tester";
import { describe, it, afterAll, beforeEach } from "vitest";
import rule from "./{rule-name}";
// If rule uses caching:
// import { clearCache } from "../utils/import-graph.js";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

// Clear cache between tests if needed
// beforeEach(() => {
//   clearCache();
// });

ruleTester.run("{rule-name}", rule, {
  valid: [
    // ============================================
    // PREFERRED PATTERN USED CORRECTLY
    // ============================================
    {
      name: "uses preferred pattern",
      code: `
        // Valid code example
      `,
    },
    {
      name: "with custom options",
      code: `...`,
      options: [{ optionName: "custom" }],
    },

    // ============================================
    // EXCEPTIONS / EDGE CASES
    // ============================================
    {
      name: "exception case is allowed",
      code: `...`,
    },
  ],

  invalid: [
    // ============================================
    // BASIC VIOLATIONS
    // ============================================
    {
      name: "violates pattern",
      code: `
        // Invalid code example
      `,
      errors: [
        {
          messageId: "messageId1",
          data: { key: "value" },
        },
      ],
    },

    // ============================================
    // WITH OPTIONS
    // ============================================
    {
      name: "violates with custom options",
      code: `...`,
      options: [{ optionName: "strict" }],
      errors: [
        {
          messageId: "messageId2",
        },
      ],
    },
  ],
});
```

### Step 5: Register the Rule

Add the rule to `packages/uilint-eslint/src/rule-registry.ts`:

```typescript
{
  id: "{rule-name}",
  name: "{Display Name}",
  description: "{Short description for CLI}",
  defaultSeverity: "warn" | "error",
  defaultOptions: [{ /* defaults */ }],
  optionSchema: {
    fields: [
      {
        key: "optionName",
        label: "Option Label",
        type: "select" | "text" | "boolean" | "number",
        defaultValue: "default",
        options: [{ value: "x", label: "X" }], // for select
        description: "Help text",
      },
    ],
  },
  category: "static",
},
```

### Step 6: Regenerate Index and Test

```bash
# Regenerate the index file
pnpm -C packages/uilint-eslint generate:index

# Run the tests
pnpm -C packages/uilint-eslint test

# Build to verify
pnpm -C packages/uilint-eslint build
```

## Common AST Patterns

### Detecting JSX Elements

```typescript
JSXOpeningElement(node) {
  // Get element name
  if (node.name.type === "JSXIdentifier") {
    const name = node.name.name;
    // Check if it's a component (PascalCase) vs HTML (lowercase)
    if (/^[A-Z]/.test(name)) {
      // It's a component
    }
  }
}
```

### Tracking Imports

```typescript
const importMap = new Map<string, string>();

return {
  ImportDeclaration(node) {
    const source = node.source.value as string;
    for (const spec of node.specifiers) {
      if (spec.type === "ImportSpecifier") {
        importMap.set(spec.local.name, source);
      }
    }
  },

  JSXOpeningElement(node) {
    if (node.name.type === "JSXIdentifier") {
      const importSource = importMap.get(node.name.name);
      // Now you know where it was imported from
    }
  },
};
```

### Checking className for Tailwind Patterns

```typescript
JSXAttribute(node) {
  if (node.name.type !== "JSXIdentifier" || node.name.name !== "className") {
    return;
  }

  if (node.value?.type === "Literal" && typeof node.value.value === "string") {
    const classes = node.value.value;
    // Analyze classes
  }
}
```

### Counting React Hooks in Components

```typescript
const componentStack: ComponentInfo[] = [];

function isComponentName(name: string): boolean {
  return /^[A-Z]/.test(name);
}

function isHookCall(callee: TSESTree.Expression): string | null {
  if (callee.type === "Identifier" && callee.name.startsWith("use")) {
    return callee.name;
  }
  return null;
}

return {
  FunctionDeclaration(node) {
    if (node.id && isComponentName(node.id.name)) {
      componentStack.push({ name: node.id.name, node, count: 0 });
    }
  },
  "FunctionDeclaration:exit"(node) {
    const component = componentStack.pop();
    if (component && component.count > threshold) {
      context.report({ node, messageId: "excessive" });
    }
  },
  CallExpression(node) {
    const hookName = isHookCall(node.callee);
    if (hookName && componentStack.length > 0) {
      componentStack[componentStack.length - 1].count++;
    }
  },
};
```

### Cross-File Analysis

For rules that need to analyze imports across files, use the import-graph utility:

```typescript
import { getComponentLibrary, clearCache } from "../utils/import-graph.js";

// In create():
"Program:exit"() {
  const filename = context.filename || context.getFilename();

  for (const usage of componentUsages) {
    const libraryInfo = getComponentLibrary(
      filename,
      usage.componentName,
      usage.importSource
    );
    // libraryInfo.library, libraryInfo.isLocalComponent, etc.
  }
}
```

## Error Message Best Practices

1. Be specific about what's wrong
2. Suggest the fix
3. Use placeholders for dynamic content

Good:
```typescript
messages: {
  useDesignSystem:
    "Use <{{preferred}}> from '{{source}}' instead of native <{{element}}>.",
}
```

Bad:
```typescript
messages: {
  error: "Invalid element",  // Too vague
}
```

## Testing Tips

1. **Test valid cases first** - Make sure correct code passes
2. **Test with options** - Verify all configuration options work
3. **Test edge cases** - JSX member expressions, aliases, spread attributes
4. **Test real-world patterns** - Forms, modals, lists, etc.
5. **Clear cache if using cross-file analysis** - Use `beforeEach`

## Reference Files

See the following files for complete working examples:

- `references/RULE-TEMPLATE.ts` - Complete rule template
- `references/TEST-TEMPLATE.ts` - Complete test template
- `references/REGISTRY-ENTRY.md` - Registry entry format

## Final Checklist

Before finishing, verify:

- [ ] Rule file created at `packages/uilint-eslint/src/rules/{name}.ts`
- [ ] Test file created at `packages/uilint-eslint/src/rules/{name}.test.ts`
- [ ] Rule added to `packages/uilint-eslint/src/rule-registry.ts`
- [ ] Index regenerated with `pnpm -C packages/uilint-eslint generate:index`
- [ ] All tests pass with `pnpm -C packages/uilint-eslint test`
- [ ] Build succeeds with `pnpm -C packages/uilint-eslint build`
- [ ] Error messages are clear and actionable
- [ ] Configuration options are documented in schema
