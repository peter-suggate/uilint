/**
 * Tests for: {rule-name}
 *
 * {Description of what this rule tests}
 *
 * Test Organization:
 * - valid: Cases that should NOT trigger errors
 * - invalid: Cases that SHOULD trigger errors
 *
 * Each section is organized by category with comment headers.
 */

import { RuleTester } from "@typescript-eslint/rule-tester";
import { describe, it, afterAll, beforeEach } from "vitest";
import rule from "./{rule-name}";
// Uncomment if your rule uses caching (cross-file analysis):
// import { clearCache } from "../utils/import-graph.js";

// Configure RuleTester to use Vitest
RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

// Create rule tester with JSX support
const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

// Clear cache between tests if rule uses cross-file analysis
// beforeEach(() => {
//   clearCache();
// });

ruleTester.run("{rule-name}", rule, {
  valid: [
    // ============================================
    // PREFERRED PATTERN - BASIC USAGE
    // ============================================
    {
      name: "uses preferred component correctly",
      code: `
        import { Button } from "@/components/ui/button";

        export function Page() {
          return <Button>Click me</Button>;
        }
      `,
    },
    {
      name: "uses multiple preferred components",
      code: `
        import { Button } from "@/components/ui/button";
        import { Card } from "@/components/ui/card";

        export function Page() {
          return (
            <Card>
              <Button>Submit</Button>
            </Card>
          );
        }
      `,
    },

    // ============================================
    // WITH CONFIGURATION OPTIONS
    // ============================================
    {
      name: "respects custom preferred component",
      code: `
        import { PrimaryButton } from "@/components/buttons";

        export function Page() {
          return <PrimaryButton>Click</PrimaryButton>;
        }
      `,
      options: [
        {
          preferred: "PrimaryButton",
          importSource: "@/components/buttons",
          elements: ["button"],
        },
      ],
    },
    {
      name: "ignores elements not in target list",
      code: `
        export function Page() {
          return <div><span>Text</span></div>;
        }
      `,
      // Default options only check "button"
    },

    // ============================================
    // EDGE CASES - SHOULD NOT ERROR
    // ============================================
    {
      name: "component defined in same file (not imported)",
      code: `
        function CustomButton({ children }) {
          return <button className="custom">{children}</button>;
        }

        export function Page() {
          return <CustomButton>Click</CustomButton>;
        }
      `,
    },
    {
      name: "inside test file (if tests are excluded)",
      code: `
        // Assuming tests are in ignore list
        export function TestComponent() {
          return <button>Test</button>;
        }
      `,
      options: [{ ignore: [".test.", ".spec."] }],
      filename: "Component.test.tsx",
    },
    {
      name: "namespace import usage",
      code: `
        import * as UI from "@/components/ui";

        export function Page() {
          return <UI.Button>Click</UI.Button>;
        }
      `,
    },

    // ============================================
    // ALIASED IMPORTS
    // ============================================
    {
      name: "aliased import of preferred component",
      code: `
        import { Button as Btn } from "@/components/ui/button";

        export function Page() {
          return <Btn>Click</Btn>;
        }
      `,
    },

    // ============================================
    // DIFFERENT COMPONENT TYPES
    // ============================================
    {
      name: "class component using preferred",
      code: `
        import { Button } from "@/components/ui/button";

        class Page extends React.Component {
          render() {
            return <Button>Click</Button>;
          }
        }
      `,
    },
    {
      name: "forwardRef component using preferred",
      code: `
        import { Button } from "@/components/ui/button";
        import { forwardRef } from "react";

        const MyComponent = forwardRef((props, ref) => {
          return <Button ref={ref}>Click</Button>;
        });
      `,
    },
  ],

  invalid: [
    // ============================================
    // BASIC VIOLATIONS
    // ============================================
    {
      name: "uses native button instead of preferred",
      code: `
        export function Page() {
          return <button>Click me</button>;
        }
      `,
      errors: [
        {
          messageId: "preferComponent",
          data: {
            preferred: "Button",
            source: "@/components/ui/button",
            element: "button",
          },
        },
      ],
    },
    {
      name: "uses native input instead of preferred",
      code: `
        export function Page() {
          return <input type="text" />;
        }
      `,
      options: [
        {
          preferred: "Input",
          importSource: "@/components/ui/input",
          elements: ["input"],
        },
      ],
      errors: [
        {
          messageId: "preferComponent",
          data: {
            preferred: "Input",
            source: "@/components/ui/input",
            element: "input",
          },
        },
      ],
    },

    // ============================================
    // MULTIPLE VIOLATIONS IN ONE FILE
    // ============================================
    {
      name: "multiple native buttons in same file",
      code: `
        export function Page() {
          return (
            <div>
              <button>First</button>
              <button>Second</button>
              <button>Third</button>
            </div>
          );
        }
      `,
      errors: [
        {
          messageId: "preferComponent",
          data: { preferred: "Button", element: "button" },
        },
        {
          messageId: "preferComponent",
          data: { preferred: "Button", element: "button" },
        },
        {
          messageId: "preferComponent",
          data: { preferred: "Button", element: "button" },
        },
      ],
    },

    // ============================================
    // MIXED USAGE (some preferred, some native)
    // ============================================
    {
      name: "mixes preferred and native elements",
      code: `
        import { Button } from "@/components/ui/button";

        export function Page() {
          return (
            <div>
              <Button>Good</Button>
              <button>Bad</button>
            </div>
          );
        }
      `,
      errors: [
        {
          messageId: "preferComponent",
          data: { preferred: "Button", element: "button" },
        },
      ],
    },

    // ============================================
    // DIFFERENT COMPONENT PATTERNS
    // ============================================
    {
      name: "arrow function component with violation",
      code: `
        const Page = () => {
          return <button>Click</button>;
        };

        export default Page;
      `,
      errors: [
        {
          messageId: "preferComponent",
        },
      ],
    },
    {
      name: "class component with violation",
      code: `
        class Page extends React.Component {
          render() {
            return <button>Click</button>;
          }
        }
      `,
      errors: [
        {
          messageId: "preferComponent",
        },
      ],
    },

    // ============================================
    // NESTED ELEMENTS
    // ============================================
    {
      name: "native button nested in other components",
      code: `
        import { Card } from "@/components/ui/card";

        export function Page() {
          return (
            <Card>
              <div>
                <button>Nested</button>
              </div>
            </Card>
          );
        }
      `,
      errors: [
        {
          messageId: "preferComponent",
        },
      ],
    },

    // ============================================
    // WITH CUSTOM OPTIONS
    // ============================================
    {
      name: "violates with custom element list",
      code: `
        export function Form() {
          return (
            <form>
              <input type="text" />
              <textarea />
              <select><option>A</option></select>
            </form>
          );
        }
      `,
      options: [
        {
          preferred: "FormControl",
          importSource: "@/components/forms",
          elements: ["input", "textarea", "select"],
        },
      ],
      errors: [
        { messageId: "preferComponent", data: { element: "input" } },
        { messageId: "preferComponent", data: { element: "textarea" } },
        { messageId: "preferComponent", data: { element: "select" } },
      ],
    },

    // ============================================
    // REAL-WORLD PATTERNS
    // ============================================
    {
      name: "form with native submit button",
      code: `
        import { Input } from "@/components/ui/input";

        export function LoginForm() {
          return (
            <form>
              <Input type="email" placeholder="Email" />
              <Input type="password" placeholder="Password" />
              <button type="submit">Login</button>
            </form>
          );
        }
      `,
      errors: [
        {
          messageId: "preferComponent",
          data: { preferred: "Button", element: "button" },
        },
      ],
    },
    {
      name: "modal with native close button",
      code: `
        import { Dialog } from "@/components/ui/dialog";

        export function Modal() {
          return (
            <Dialog>
              <h2>Title</h2>
              <p>Content</p>
              <button onClick={close}>Close</button>
            </Dialog>
          );
        }
      `,
      errors: [
        {
          messageId: "preferComponent",
        },
      ],
    },

    // ============================================
    // EDGE CASES THAT SHOULD STILL ERROR
    // ============================================
    {
      name: "button with many attributes still errors",
      code: `
        export function Page() {
          return (
            <button
              type="button"
              onClick={handleClick}
              className="custom-class"
              disabled={isDisabled}
              aria-label="Action"
            >
              Click
            </button>
          );
        }
      `,
      errors: [
        {
          messageId: "preferComponent",
        },
      ],
    },
    {
      name: "self-closing button errors",
      code: `
        export function Page() {
          return <button />;
        }
      `,
      errors: [
        {
          messageId: "preferComponent",
        },
      ],
    },
  ],
});

// ============================================
// ADDITIONAL TEST PATTERNS (for reference)
// ============================================

/*
 * Testing with specific error locations:
 *
 * {
 *   name: "error at specific location",
 *   code: `line1\nline2\n<button>here</button>`,
 *   errors: [{
 *     messageId: "preferComponent",
 *     line: 3,
 *     column: 1,
 *   }],
 * }
 *
 * Testing with autofix (if rule supports fixing):
 *
 * {
 *   name: "autofixes native to preferred",
 *   code: `<button>Click</button>`,
 *   output: `<Button>Click</Button>`,
 *   errors: [{ messageId: "preferComponent" }],
 * }
 *
 * Testing error count without specific messages:
 *
 * {
 *   name: "reports 3 errors",
 *   code: `...`,
 *   errors: 3,  // Just count, no details
 * }
 */
