/**
 * Tests for: no-unsafe-type-casts
 *
 * Tests the detection of unsafe type casting patterns that bypass TypeScript's type system.
 */

import { RuleTester } from "@typescript-eslint/rule-tester";
import { describe, afterAll } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import rule from "./no-unsafe-type-casts.js";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = (text, method) => {
  // Use vitest's it function
  return (globalThis as any).it(text, method);
};

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

// Separate tester for legacy syntax tests (no JSX to avoid parsing issues)
const legacyRuleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: {
      ecmaFeatures: { jsx: false },
    },
  },
});

ruleTester.run("no-unsafe-type-casts", rule, {
  valid: [
    // ============================================
    // PROPER TYPING (no casts needed)
    // ============================================
    {
      name: "properly typed variable",
      code: `const user: User = { name: "John", email: "john@example.com" };`,
    },
    {
      name: "type inference without cast",
      code: `const data = fetchUser(); // returns Promise<User>`,
    },
    {
      name: "generic function without cast",
      code: `function identity<T>(value: T): T { return value; }`,
    },

    // ============================================
    // TYPE GUARDS (proper narrowing)
    // ============================================
    {
      name: "using type guard instead of cast",
      code: `
        function isUser(data: unknown): data is User {
          return typeof data === "object" && data !== null && "email" in data;
        }
        const result = fetchData();
        if (isUser(result)) { console.log(result.email); }
      `,
    },
    {
      name: "instanceof narrowing",
      code: `
        function handleError(err: unknown) {
          if (err instanceof Error) { console.log(err.message); }
        }
      `,
    },
    {
      name: "typeof narrowing",
      code: `
        function processValue(value: unknown) {
          if (typeof value === "string") { console.log(value.toUpperCase()); }
        }
      `,
    },

    // ============================================
    // RUNTIME VALIDATION (Zod-style)
    // ============================================
    {
      name: "Zod schema validation",
      code: `
        const UserSchema = z.object({ name: z.string(), email: z.string() });
        const user = UserSchema.parse(jsonData);
      `,
    },

    // ============================================
    // ALLOWED TYPES (configured exceptions)
    // ============================================
    {
      name: "casting to allowed type (HTMLElement)",
      code: `const element = document.getElementById("app") as HTMLElement;`,
      options: [{ allowedTypes: ["HTMLElement"] }],
    },
    {
      name: "casting to allowed type (HTMLInputElement)",
      code: `const input = document.querySelector("input") as HTMLInputElement;`,
      options: [{ allowedTypes: ["HTMLInputElement"] }],
    },
    {
      name: "casting to allowed type (Error)",
      code: `const error = err as Error;`,
      options: [{ allowedTypes: ["Error"] }],
    },
    {
      name: "casting to multiple allowed types",
      code: `
        const el = document.getElementById("id") as HTMLElement;
        const input = document.querySelector("input") as HTMLInputElement;
      `,
      options: [{ allowedTypes: ["HTMLElement", "HTMLInputElement"] }],
    },

    // ============================================
    // TEST FILES (allowed by default)
    // ============================================
    {
      name: "as any allowed in test file",
      code: `const mock = jest.fn() as any;`,
      filename: "component.test.ts",
    },
    {
      name: "as any allowed in spec file",
      code: `const spy = vi.fn() as any;`,
      filename: "utils.spec.ts",
    },
    {
      name: "as any allowed in __tests__ directory",
      code: `const data = {} as any;`,
      filename: "__tests__/integration.ts",
    },
    {
      name: "double-cast allowed in test file",
      code: `const user = {} as unknown as User;`,
      filename: "api.test.tsx",
    },

    // ============================================
    // CATCH BLOCKS (allowed by default)
    // ============================================
    {
      name: "as any in catch block",
      code: `
        try { throw new Error("test"); }
        catch (e) { const err = e as any; console.log(err.message); }
      `,
    },
    {
      name: "as Error in catch block",
      code: `
        try { await fetchData(); }
        catch (e) { const err = e as Error; console.log(err.message); }
      `,
    },
    {
      name: "nested catch block",
      code: `
        async function run() {
          try {
            await outer();
          } catch (e) {
            try { await inner(); }
            catch (inner) { const x = inner as any; }
          }
        }
      `,
    },

    // ============================================
    // DISABLED REPORTING OPTIONS
    // ============================================
    {
      name: "as any when reportAsAny is false",
      code: `const data = response as any;`,
      options: [{ reportAsAny: false }],
    },
    {
      name: "as unknown when reportAsUnknown is false (default)",
      code: `const data = response as unknown;`,
    },
    {
      name: "double-cast when reportDoubleCast is false",
      code: `const user = data as unknown as User;`,
      options: [{ reportDoubleCast: false }],
    },

    // ============================================
    // REGULAR TYPE CASTS (not flagged by default)
    // ============================================
    {
      name: "casting between compatible types",
      code: `const strOrNum: string | number = 42; const num = strOrNum as number;`,
    },
    {
      name: "casting to interface",
      code: `
        interface User { name: string; }
        const user = apiResponse as User;
      `,
    },
    {
      name: "casting generic type",
      code: `const items = response as Array<string>;`,
    },

    // ============================================
    // NON-CAST EXPRESSIONS
    // ============================================
    {
      name: "type annotation is not a cast",
      code: `const user: User = { name: "John" };`,
    },
    {
      name: "generic parameter is not a cast",
      code: `const arr = new Array<any>();`,
    },
    {
      name: "function return type is not a cast",
      code: `function getData(): any { return null; }`,
    },
  ],

  invalid: [
    // ============================================
    // AS ANY PATTERNS
    // ============================================
    {
      name: "simple as any cast",
      code: `const data = response as any;`,
      errors: [{ messageId: "noAsAny" }],
    },
    {
      name: "as any in function argument",
      code: `processData(input as any);`,
      errors: [{ messageId: "noAsAny" }],
    },
    {
      name: "as any in return statement",
      code: `function getData() { return fetchResult as any; }`,
      errors: [{ messageId: "noAsAny" }],
    },
    {
      name: "as any in variable declaration",
      code: `const config: Config = defaultConfig as any;`,
      errors: [{ messageId: "noAsAny" }],
    },
    {
      name: "as any in object property",
      code: `const obj = { data: response as any };`,
      errors: [{ messageId: "noAsAny" }],
    },
    {
      name: "as any in array element",
      code: `const items = [item1, item2 as any, item3];`,
      errors: [{ messageId: "noAsAny" }],
    },
    {
      name: "as any in ternary expression",
      code: `const result = condition ? value : fallback as any;`,
      errors: [{ messageId: "noAsAny" }],
    },
    {
      name: "chained as any",
      code: `const data = (obj.nested.value as any).method();`,
      errors: [{ messageId: "noAsAny" }],
    },

    // ============================================
    // AS UNKNOWN PATTERNS (when enabled)
    // ============================================
    {
      name: "simple as unknown cast",
      code: `const data = response as unknown;`,
      options: [{ reportAsUnknown: true }],
      errors: [{ messageId: "noAsUnknown" }],
    },
    {
      name: "as unknown in function argument",
      code: `processData(input as unknown);`,
      options: [{ reportAsUnknown: true }],
      errors: [{ messageId: "noAsUnknown" }],
    },

    // ============================================
    // DOUBLE-CAST PATTERNS
    // ============================================
    {
      name: "double-cast with unknown",
      code: `const user = data as unknown as User;`,
      errors: [
        {
          messageId: "noDoubleCast",
          data: { targetType: "User" },
        },
      ],
    },
    {
      name: "double-cast with any (reports both double-cast and inner as any)",
      code: `const user = data as any as User;`,
      errors: [
        // Double-cast is reported first (outer expression)
        {
          messageId: "noDoubleCast",
          data: { targetType: "User" },
        },
        // Inner as any is also reported
        { messageId: "noAsAny" },
      ],
    },
    {
      name: "double-cast in function call",
      code: `processUser(data as unknown as User);`,
      errors: [
        {
          messageId: "noDoubleCast",
          data: { targetType: "User" },
        },
      ],
    },
    {
      name: "double-cast with qualified type name",
      code: `const component = element as unknown as React.Component;`,
      errors: [
        {
          messageId: "noDoubleCast",
          data: { targetType: "React.Component" },
        },
      ],
    },
    {
      name: "double-cast to type reference",
      code: `const num = str as unknown as Number;`,
      errors: [
        {
          messageId: "noDoubleCast",
          data: { targetType: "Number" },
        },
      ],
    },

    // ============================================
    // MULTIPLE VIOLATIONS
    // ============================================
    {
      name: "multiple as any casts",
      code: `
        const a = x as any;
        const b = y as any;
      `,
      errors: [{ messageId: "noAsAny" }, { messageId: "noAsAny" }],
    },
    {
      name: "mixed violation types",
      code: `
        const a = x as any;
        const b = y as unknown as User;
      `,
      errors: [
        { messageId: "noAsAny" },
        { messageId: "noDoubleCast", data: { targetType: "User" } },
      ],
    },

    // ============================================
    // TEST FILES WITH allowInTestFiles: false
    // ============================================
    {
      name: "as any in test file when not allowed",
      code: `const mock = jest.fn() as any;`,
      filename: "component.test.ts",
      options: [{ allowInTestFiles: false }],
      errors: [{ messageId: "noAsAny" }],
    },

    // ============================================
    // CATCH BLOCKS WITH allowInCatchBlocks: false
    // ============================================
    {
      name: "as any in catch block when not allowed",
      code: `
        try { throw new Error(); }
        catch (e) { const err = e as any; }
      `,
      options: [{ allowInCatchBlocks: false }],
      errors: [{ messageId: "noAsAny" }],
    },

    // ============================================
    // EDGE CASES
    // ============================================
    {
      name: "as any in JSX expression",
      code: `const element = <Component data={value as any} />;`,
      errors: [{ messageId: "noAsAny" }],
    },
    {
      name: "as any in template literal",
      code: `const str = \`Value: \${data as any}\`;`,
      errors: [{ messageId: "noAsAny" }],
    },
    {
      name: "as any after await",
      code: `const data = await fetch(url) as any;`,
      errors: [{ messageId: "noAsAny" }],
    },
  ],
});

// ============================================
// LEGACY ANGLE-BRACKET SYNTAX TESTS
// (Separate tester without JSX to avoid parsing conflicts)
// ============================================
legacyRuleTester.run("no-unsafe-type-casts (legacy syntax)", rule, {
  valid: [],
  invalid: [
    {
      name: "legacy <any> syntax",
      code: `const data = <any>response;`,
      errors: [{ messageId: "noLegacyAsAny" }],
    },
    {
      name: "legacy <unknown> syntax",
      code: `const data = <unknown>response;`,
      options: [{ reportAsUnknown: true }],
      errors: [{ messageId: "noLegacyAsUnknown" }],
    },
    {
      name: "legacy double-cast <Type><unknown>",
      code: `const user = <User><unknown>data;`,
      errors: [
        {
          messageId: "noDoubleCast",
          data: { targetType: "User" },
        },
      ],
    },
  ],
});

// ============================================
// ADDITIONAL EDGE CASE TESTS
// ============================================
describe("no-unsafe-type-casts edge cases", () => {
  const edgeCaseRuleTester = new RuleTester({
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
  });

  edgeCaseRuleTester.run("double-cast variations", rule, {
    valid: [
      {
        name: "single cast to unknown followed by type guard",
        code: `
          const data = response as unknown;
          if (isUser(data)) { console.log(data.email); }
        `,
      },
    ],
    invalid: [
      {
        name: "triple cast pattern (reports 2 double-casts)",
        code: `const x = data as unknown as any as User;`,
        // Both nested double-casts are reported
        errors: [{ messageId: "noDoubleCast" }, { messageId: "noDoubleCast" }],
      },
    ],
  });
});

// ============================================
// FIXTURE-BASED TESTS
// ============================================
const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "__fixtures__/no-unsafe-type-casts");

// Read fixture file at module level
const fixtureCode = readFileSync(
  join(FIXTURES_DIR, "unsafe-casts.ts"),
  "utf-8"
);

// Create a separate tester for fixture (no JSX for legacy syntax in fixture)
const fixtureRuleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: {
      ecmaFeatures: { jsx: false },
    },
  },
});

fixtureRuleTester.run("no-unsafe-type-casts (fixture)", rule, {
  valid: [],
  invalid: [
    {
      name: "fixture file with multiple unsafe cast patterns",
      code: fixtureCode,
      errors: [
        // AS ANY PATTERNS (3 occurrences)
        { messageId: "noAsAny" }, // response.data as any
        { messageId: "noAsAny" }, // payload as any
        { messageId: "noAsAny" }, // obj as any
        // DOUBLE-CAST PATTERNS (3 occurrences)
        // Note: "as any as" also reports an inner "as any"
        { messageId: "noDoubleCast" }, // jsonData as unknown as User
        { messageId: "noDoubleCast" }, // input as any as number[]
        { messageId: "noAsAny" }, // inner "as any" from the double-cast above
        { messageId: "noDoubleCast" }, // response.data as unknown as User[]
        // LEGACY SYNTAX PATTERNS (2 occurrences)
        { messageId: "noLegacyAsAny" }, // <any>value
        { messageId: "noDoubleCast" }, // <User><unknown>data
      ],
    },
  ],
});
