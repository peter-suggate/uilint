/**
 * Tests for: zustand-use-selectors
 *
 * Tests the enforcement of selector functions when accessing Zustand stores.
 */

import { RuleTester } from "@typescript-eslint/rule-tester";
import { describe, it, afterAll } from "vitest";
import rule from "./zustand-use-selectors.js";

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

ruleTester.run("zustand-use-selectors", rule, {
  valid: [
    // ============================================
    // ARROW FUNCTION SELECTORS
    // ============================================
    {
      name: "arrow function selector - single property",
      code: `const count = useStore((state) => state.count);`,
    },
    {
      name: "arrow function selector - nested property",
      code: `const name = useUserStore((s) => s.user.name);`,
    },
    {
      name: "arrow function selector - computed value",
      code: `const total = useCartStore((s) => s.items.reduce((a, b) => a + b.price, 0));`,
    },
    {
      name: "arrow function selector - returning object",
      code: `const { count, name } = useStore((s) => ({ count: s.count, name: s.name }));`,
    },
    {
      name: "arrow function selector - with block body",
      code: `const items = useStore((state) => { return state.items; });`,
    },

    // ============================================
    // NAMED SELECTOR REFERENCES
    // ============================================
    {
      name: "named selector function",
      code: `
        const selectCount = (state) => state.count;
        const count = useStore(selectCount);
      `,
    },
    {
      name: "imported selector",
      code: `const user = useAuthStore(selectCurrentUser);`,
    },
    {
      name: "selector from object",
      code: `const count = useStore(selectors.count);`,
    },

    // ============================================
    // USESHALLOW PATTERN
    // ============================================
    {
      name: "useShallow with arrow selector",
      code: `const { count, name } = useStore(useShallow((s) => ({ count: s.count, name: s.name })));`,
    },
    {
      name: "useShallow with named selector",
      code: `const data = useStore(useShallow(selectUserData));`,
    },
    {
      name: "useShallow - complex selection",
      code: `const items = useCartStore(useShallow((s) => s.items.filter(i => i.active)));`,
    },

    // ============================================
    // FUNCTION EXPRESSION SELECTORS
    // ============================================
    {
      name: "function expression selector",
      code: `const count = useStore(function(state) { return state.count; });`,
    },

    // ============================================
    // ACTIONS/METHODS (still with selector)
    // ============================================
    {
      name: "selecting an action",
      code: `const increment = useStore((s) => s.increment);`,
    },
    {
      name: "selecting multiple actions",
      code: `const { increment, decrement } = useStore((s) => ({ increment: s.increment, decrement: s.decrement }));`,
    },

    // ============================================
    // NON-STORE HOOKS (not matching pattern)
    // ============================================
    {
      name: "useState - not a store",
      code: `const [count, setCount] = useState(0);`,
    },
    {
      name: "useEffect - not a store",
      code: `useEffect(() => {}, []);`,
    },
    {
      name: "custom hook not matching pattern",
      code: `const data = useData();`,
    },
    {
      name: "useSomething - not matching Store pattern",
      code: `const result = useSomething();`,
    },

    // ============================================
    // CUSTOM STORE PATTERNS
    // ============================================
    {
      name: "custom pattern - useGlobalStore",
      code: `const value = useGlobalStore((s) => s.value);`,
      options: [{ storePattern: "^useGlobal\\w*$" }],
    },

    // ============================================
    // INLINE SELECTORS (allowed by default)
    // ============================================
    {
      name: "inline arrow allowed by default",
      code: `const count = useStore((s) => s.count);`,
      options: [{ requireNamedSelectors: false }],
    },

    // ============================================
    // NAMED SELECTORS REQUIRED (when option set)
    // ============================================
    {
      name: "named selector when required",
      code: `const count = useStore(selectCount);`,
      options: [{ requireNamedSelectors: true }],
    },
    {
      name: "useShallow allowed even when named required",
      code: `const data = useStore(useShallow((s) => s.data));`,
      options: [{ requireNamedSelectors: true, allowShallow: true }],
    },
  ],

  invalid: [
    // ============================================
    // NO SELECTOR AT ALL
    // ============================================
    {
      name: "no arguments to store hook",
      code: `const state = useStore();`,
      errors: [
        {
          messageId: "missingSelector",
          data: { storeName: "useStore" },
        },
      ],
    },
    {
      name: "no arguments - destructuring",
      code: `const { count, name } = useStore();`,
      errors: [
        {
          messageId: "missingSelector",
          data: { storeName: "useStore" },
        },
      ],
    },
    {
      name: "no arguments - custom store name",
      code: `const user = useAuthStore();`,
      errors: [
        {
          messageId: "missingSelector",
          data: { storeName: "useAuthStore" },
        },
      ],
    },
    {
      name: "no arguments - useCartStore",
      code: `const cart = useCartStore();`,
      errors: [
        {
          messageId: "missingSelector",
          data: { storeName: "useCartStore" },
        },
      ],
    },

    // ============================================
    // MULTIPLE VIOLATIONS
    // ============================================
    {
      name: "multiple stores without selectors",
      code: `
        const auth = useAuthStore();
        const cart = useCartStore();
        const ui = useUIStore();
      `,
      errors: [
        {
          messageId: "missingSelector",
          data: { storeName: "useAuthStore" },
        },
        {
          messageId: "missingSelector",
          data: { storeName: "useCartStore" },
        },
        {
          messageId: "missingSelector",
          data: { storeName: "useUIStore" },
        },
      ],
    },

    // ============================================
    // IN COMPONENT CONTEXT
    // ============================================
    {
      name: "inside component - no selector",
      code: `
        function Counter() {
          const { count } = useStore();
          return <span>{count}</span>;
        }
      `,
      errors: [
        {
          messageId: "missingSelector",
          data: { storeName: "useStore" },
        },
      ],
    },
    {
      name: "inside arrow component - no selector",
      code: `
        const Counter = () => {
          const state = useCounterStore();
          return <span>{state.count}</span>;
        };
      `,
      errors: [
        {
          messageId: "missingSelector",
          data: { storeName: "useCounterStore" },
        },
      ],
    },

    // ============================================
    // REQUIRE NAMED SELECTORS VIOLATIONS
    // ============================================
    {
      name: "inline arrow when named required",
      code: `const count = useStore((s) => s.count);`,
      options: [{ requireNamedSelectors: true }],
      errors: [
        {
          messageId: "useSelectorFunction",
          data: { storeName: "useStore" },
        },
      ],
    },
    {
      name: "inline function expression when named required",
      code: `const count = useStore(function(s) { return s.count; });`,
      options: [{ requireNamedSelectors: true }],
      errors: [
        {
          messageId: "useSelectorFunction",
          data: { storeName: "useStore" },
        },
      ],
    },

    // ============================================
    // CUSTOM PATTERNS
    // ============================================
    {
      name: "custom pattern match without selector",
      code: `const value = useGlobalData();`,
      options: [{ storePattern: "^useGlobal\\w*$" }],
      errors: [
        {
          messageId: "missingSelector",
          data: { storeName: "useGlobalData" },
        },
      ],
    },

    // ============================================
    // MIXED VALID AND INVALID
    // ============================================
    {
      name: "mix of valid and invalid store calls",
      code: `
        const count = useStore((s) => s.count);  // valid
        const user = useAuthStore();               // invalid
        const cart = useCartStore((s) => s.items); // valid
        const ui = useUIStore();                   // invalid
      `,
      errors: [
        {
          messageId: "missingSelector",
          data: { storeName: "useAuthStore" },
        },
        {
          messageId: "missingSelector",
          data: { storeName: "useUIStore" },
        },
      ],
    },

    // ============================================
    // EDGE CASES
    // ============================================
    {
      name: "store in conditional",
      code: `const data = condition ? useStore() : null;`,
      errors: [
        {
          messageId: "missingSelector",
          data: { storeName: "useStore" },
        },
      ],
    },
    {
      name: "store in object property",
      code: `const obj = { data: useDataStore() };`,
      errors: [
        {
          messageId: "missingSelector",
          data: { storeName: "useDataStore" },
        },
      ],
    },
    {
      name: "store as function argument",
      code: `someFunction(useStore());`,
      errors: [
        {
          messageId: "missingSelector",
          data: { storeName: "useStore" },
        },
      ],
    },
  ],
});
