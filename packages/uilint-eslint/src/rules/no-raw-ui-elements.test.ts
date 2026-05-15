/**
 * Tests for: no-raw-ui-elements
 *
 * Ensures raw UI controls are reported with framework-specific replacements.
 */

import { RuleTester } from "@typescript-eslint/rule-tester";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, it, afterAll } from "vitest";
import rule from "./no-raw-ui-elements.js";

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

const tempRoot = mkdtempSync(join(tmpdir(), "uilint-no-raw-ui-elements-"));
const shadcnProject = join(tempRoot, "shadcn-project");
const muiProject = join(tempRoot, "mui-project");
const plainProject = join(tempRoot, "plain-project");
const tsconfigAliasProject = join(tempRoot, "tsconfig-alias-project");
const relativeAliasProject = join(tempRoot, "relative-alias-project");
const invalidConfigProject = join(tempRoot, "invalid-config-project");
const missingAliasProject = join(tempRoot, "missing-alias-project");

mkdirSync(join(shadcnProject, "components", "ui"), { recursive: true });
mkdirSync(join(shadcnProject, "app"), { recursive: true });
writeFileSync(
  join(shadcnProject, "package.json"),
  JSON.stringify({ dependencies: { react: "^19.0.0" } })
);
writeFileSync(join(shadcnProject, "components", "ui", "button.tsx"), "");

mkdirSync(join(muiProject, "src"), { recursive: true });
writeFileSync(
  join(muiProject, "package.json"),
  JSON.stringify({ dependencies: { "@mui/material": "^7.0.0" } })
);

mkdirSync(join(plainProject, "src"), { recursive: true });
writeFileSync(
  join(plainProject, "package.json"),
  JSON.stringify({ dependencies: { react: "^19.0.0" } })
);

mkdirSync(join(tsconfigAliasProject, "src", "components", "ui"), {
  recursive: true,
});
mkdirSync(join(tsconfigAliasProject, "src", "pages"), { recursive: true });
writeFileSync(
  join(tsconfigAliasProject, "package.json"),
  JSON.stringify({ dependencies: { react: "^19.0.0" } })
);
writeFileSync(
  join(tsconfigAliasProject, "components.json"),
  JSON.stringify({ aliases: { ui: "@/components/ui" } })
);
writeFileSync(
  join(tsconfigAliasProject, "tsconfig.json"),
  JSON.stringify({
    compilerOptions: {
      baseUrl: ".",
      paths: { "@/*": ["./src/*"] },
    },
  })
);
writeFileSync(
  join(tsconfigAliasProject, "src", "components", "ui", "button.tsx"),
  ""
);

mkdirSync(join(relativeAliasProject, "src", "design-system", "ui"), {
  recursive: true,
});
mkdirSync(join(relativeAliasProject, "src"), { recursive: true });
writeFileSync(
  join(relativeAliasProject, "package.json"),
  JSON.stringify({ dependencies: { react: "^19.0.0" } })
);
writeFileSync(
  join(relativeAliasProject, "components.json"),
  JSON.stringify({ aliases: { ui: "src/design-system/ui" } })
);
writeFileSync(
  join(relativeAliasProject, "src", "design-system", "ui", "textarea.tsx"),
  ""
);

mkdirSync(join(invalidConfigProject, "components", "ui"), {
  recursive: true,
});
mkdirSync(join(invalidConfigProject, "src"), { recursive: true });
writeFileSync(
  join(invalidConfigProject, "package.json"),
  JSON.stringify({ dependencies: { react: "^19.0.0" } })
);
writeFileSync(join(invalidConfigProject, "components.json"), "{ invalid json");
writeFileSync(join(invalidConfigProject, "components", "ui", "input.tsx"), "");

mkdirSync(join(missingAliasProject, "src"), { recursive: true });
writeFileSync(
  join(missingAliasProject, "package.json"),
  JSON.stringify({ dependencies: { react: "^19.0.0" } })
);
writeFileSync(
  join(missingAliasProject, "components.json"),
  JSON.stringify({ aliases: { ui: "@/missing/ui" } })
);
writeFileSync(
  join(missingAliasProject, "tsconfig.json"),
  JSON.stringify({
    compilerOptions: {
      baseUrl: ".",
      paths: { "@/*": ["./src/*"] },
    },
  })
);

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

ruleTester.run("no-raw-ui-elements", rule, {
  valid: [
    {
      name: "auto mode does not report when no component framework is detected",
      filename: join(plainProject, "src", "Form.tsx"),
      code: `
        export function Form() {
          return <button type="button">Save</button>;
        }
      `,
    },
    {
      name: "allows configured framework components",
      code: `
        import { Button } from "@/components/ui/button";
        export function Form() {
          return <Button type="button">Save</Button>;
        }
      `,
      options: [{ preferred: "shadcn" }],
    },
    {
      name: "allows raw button inside shadcn button primitive implementation",
      filename: join(shadcnProject, "components", "ui", "button.tsx"),
      code: `
        export function Button() {
          return <button type="button" />;
        }
      `,
      options: [{ preferred: "shadcn" }],
    },
    {
      name: "respects ignoreFiles substrings",
      filename: join(shadcnProject, "legacy", "Form.tsx"),
      code: `
        export function Form() {
          return <textarea />;
        }
      `,
      options: [{ preferred: "shadcn", ignoreFiles: ["legacy"] }],
    },
    {
      name: "does not report elements outside the configured element list",
      code: `
        export function Form() {
          return <textarea />;
        }
      `,
      options: [{ preferred: "shadcn", elements: ["button"] }],
    },
    {
      name: "auto mode does not report when components.json alias resolves to missing dir",
      filename: join(missingAliasProject, "src", "Form.tsx"),
      code: `
        export function Form() {
          return <button type="button">Save</button>;
        }
      `,
    },
    {
      name: "allows raw button inside configured shadcn primitive implementation",
      filename: join(
        tsconfigAliasProject,
        "src",
        "components",
        "ui",
        "button.tsx"
      ),
      code: `
        export function Button() {
          return <button type="button" />;
        }
      `,
      options: [{ preferred: "shadcn" }],
    },
  ],

  invalid: [
    {
      name: "reports raw button with shadcn replacement",
      code: `
        export function Form() {
          return <button type="submit">Save</button>;
        }
      `,
      options: [{ preferred: "shadcn" }],
      errors: [
        {
          messageId: "rawElement",
          data: {
            element: "button",
            framework: "shadcn/ui",
            replacement: 'Button from "@/components/ui/button"',
          },
        },
      ],
    },
    {
      name: "reports textarea with MUI replacement",
      code: `
        export function Form() {
          return <textarea />;
        }
      `,
      options: [{ preferred: "mui" }],
      errors: [
        {
          messageId: "rawElement",
          data: {
            element: "textarea",
            framework: "MUI",
            replacement: 'TextField with multiline from "@mui/material"',
          },
        },
      ],
    },
    {
      name: "reports checkbox inputs with checkbox replacement",
      code: `
        export function Form() {
          return <input type="checkbox" />;
        }
      `,
      options: [{ preferred: "shadcn" }],
      errors: [
        {
          messageId: "rawElement",
          data: {
            element: "input",
            framework: "shadcn/ui",
            replacement: 'Checkbox from "@/components/ui/checkbox"',
          },
        },
      ],
    },
    {
      name: "reports auto-detected shadcn projects",
      filename: join(shadcnProject, "app", "Form.tsx"),
      code: `
        export function Form() {
          return <button type="button">Cancel</button>;
        }
      `,
      options: [{ preferred: "auto" }],
      errors: [
        {
          messageId: "rawElement",
          data: {
            element: "button",
            framework: "shadcn/ui",
            replacement: 'Button from "@/components/ui/button"',
          },
        },
      ],
    },
    {
      name: "reports shadcn from components.json alias resolved through tsconfig paths",
      filename: join(tsconfigAliasProject, "src", "pages", "Form.tsx"),
      code: `
        export function Form() {
          return <button type="button">Cancel</button>;
        }
      `,
      errors: [
        {
          messageId: "rawElement",
          data: {
            element: "button",
            framework: "shadcn/ui",
            replacement: 'Button from "@/components/ui/button"',
          },
        },
      ],
    },
    {
      name: "reports shadcn from components.json relative alias",
      filename: join(relativeAliasProject, "src", "Form.tsx"),
      code: `
        export function Form() {
          return <textarea />;
        }
      `,
      errors: [
        {
          messageId: "rawElement",
          data: {
            element: "textarea",
            framework: "shadcn/ui",
            replacement: 'Textarea from "@/components/ui/textarea"',
          },
        },
      ],
    },
    {
      name: "falls back to hard-coded shadcn locations when components.json is invalid",
      filename: join(invalidConfigProject, "src", "Form.tsx"),
      code: `
        export function Form() {
          return <input />;
        }
      `,
      errors: [
        {
          messageId: "rawElement",
          data: {
            element: "input",
            framework: "shadcn/ui",
            replacement: 'Input from "@/components/ui/input"',
          },
        },
      ],
    },
    {
      name: "reports auto-detected MUI projects",
      filename: join(muiProject, "src", "Form.tsx"),
      code: `
        export function Form() {
          return <select />;
        }
      `,
      errors: [
        {
          messageId: "rawElement",
          data: {
            element: "select",
            framework: "MUI",
            replacement: 'Select from "@mui/material"',
          },
        },
      ],
    },
    {
      name: "uses custom component overrides",
      code: `
        export function Form() {
          return <button type="button">Save</button>;
        }
      `,
      options: [
        {
          preferred: "custom",
          components: {
            button: "PrimaryButton from @/design-system/controls",
          },
        },
      ],
      errors: [
        {
          messageId: "rawElement",
          data: {
            element: "button",
            framework: "your component framework",
            replacement: "PrimaryButton from @/design-system/controls",
          },
        },
      ],
    },
  ],
});
