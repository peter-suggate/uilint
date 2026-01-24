/**
 * Rule: no-mixed-component-libraries
 *
 * Forbids using non-preferred UI component libraries. Reports errors at
 * the JSX usage site, including transitive usage through local components.
 *
 * Examples:
 * - <MuiButton> from @mui/material -> error at <MuiButton> usage
 * - <MyCard> that internally uses MUI -> error at <MyCard> usage
 */

import type { TSESTree } from "@typescript-eslint/utils";
import { createRule, defineRuleMeta } from "../../utils/create-rule.js";
import {
  getComponentLibrary,
  type LibraryName,
} from "./lib/import-graph.js";

type MessageIds = "nonPreferredLibrary" | "transitiveNonPreferred";
type Options = [
  {
    /** The preferred UI library. Components from other libraries will be flagged. */
    preferred: LibraryName;
    /** Additional libraries to detect (defaults to common ones) */
    libraries?: LibraryName[];
  }
];

/**
 * Rule metadata - colocated with implementation for maintainability
 */
export const meta = defineRuleMeta({
  id: "no-mixed-component-libraries",
  version: "1.0.0",
  name: "No Mixed Component Libraries",
  description: "Forbid mixing component libraries (e.g., shadcn + MUI)",
  defaultSeverity: "error",
  category: "static",
  icon: "🧩",
  hint: "Ensures consistent UI library usage",
  defaultEnabled: true,
  isDirectoryBased: true,
  defaultOptions: [{ preferred: "shadcn", libraries: ["shadcn", "mui"] }],
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
          { value: "chakra", label: "Chakra UI" },
          { value: "antd", label: "Ant Design" },
        ],
        description: "The preferred UI library. Components from other libraries will be flagged.",
      },
    ],
  },
  docs: `
## What it does

Detects and reports when components from non-preferred UI libraries are used in your codebase.
This includes both direct imports and transitive usage through your own components that wrap
non-preferred libraries internally.

## Why it's useful

- **Consistency**: Ensures a uniform look and feel across your application
- **Bundle size**: Prevents accidentally including multiple UI frameworks
- **Maintenance**: Reduces the number of styling systems to maintain
- **Migration support**: Helps identify what needs to change when migrating UI libraries

## Examples

### ❌ Incorrect (with preferred: "shadcn")

\`\`\`tsx
// Direct MUI usage
import { Button } from '@mui/material';
<Button>Click me</Button>  // Error: Component <Button> is from mui

// Transitive usage through local component
import { MyCard } from './components/MyCard';  // MyCard uses MUI internally
<MyCard />  // Error: Component <MyCard> internally uses mui components
\`\`\`

### ✅ Correct

\`\`\`tsx
// Using the preferred library
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

<Button>Click me</Button>
<Card>Content</Card>
\`\`\`

## Configuration

\`\`\`js
// eslint.config.js
"uilint/no-mixed-component-libraries": ["error", {
  preferred: "shadcn",  // Your preferred library
  libraries: ["shadcn", "mui", "chakra", "antd"]  // Libraries to detect
}]
\`\`\`

## Supported Libraries

- **shadcn**: shadcn/ui components (imports from \`@/components/ui/\`)
- **mui**: Material-UI (\`@mui/material\`, \`@mui/joy\`)
- **chakra**: Chakra UI (\`@chakra-ui/react\`)
- **antd**: Ant Design (\`antd\`)
`,

});

/**
 * Information about a component usage in the file
 */
interface ComponentUsage {
  /** The JSX element node (for error reporting) */
  node: TSESTree.JSXOpeningElement;
  /** Component name (e.g., "Button", "MuiCard") */
  componentName: string;
  /** Import source (e.g., "@mui/material", "./components/cards") */
  importSource: string;
}

export default createRule<Options, MessageIds>({
  name: "no-mixed-component-libraries",
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid using non-preferred UI component libraries. Reports at JSX usage sites, including transitive usage.",
    },
    messages: {
      nonPreferredLibrary:
        "Component <{{component}}> is from {{library}}, but {{preferred}} is the preferred library.",
      transitiveNonPreferred:
        "Component <{{component}}> internally uses {{libraries}} components ({{internalComponents}}). The preferred library is {{preferred}}.",
    },
    schema: [
      {
        type: "object",
        properties: {
          preferred: {
            type: "string",
            enum: ["shadcn", "mui", "chakra", "antd"],
            description: "The preferred UI library",
          },
          libraries: {
            type: "array",
            items: {
              type: "string",
              enum: ["shadcn", "mui", "chakra", "antd"],
            },
            description: "Libraries to detect (defaults to all)",
          },
        },
        required: ["preferred"],
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [
    { preferred: "shadcn", libraries: ["shadcn", "mui", "chakra", "antd"] },
  ],
  create(context) {
    const options = context.options[0];
    const preferred = options.preferred;

    // Track imports: localName -> importSource
    const importMap = new Map<string, string>();

    // Track all component usages for analysis at Program:exit
    const componentUsages: ComponentUsage[] = [];

    return {
      ImportDeclaration(node) {
        const source = node.source.value as string;

        for (const spec of node.specifiers) {
          if (spec.type === "ImportSpecifier") {
            importMap.set(spec.local.name, source);
          } else if (spec.type === "ImportDefaultSpecifier") {
            importMap.set(spec.local.name, source);
          } else if (spec.type === "ImportNamespaceSpecifier") {
            importMap.set(spec.local.name, source);
          }
        }
      },

      JSXOpeningElement(node) {
        // Get the component name
        let componentName: string | null = null;

        if (node.name.type === "JSXIdentifier") {
          componentName = node.name.name;
        } else if (node.name.type === "JSXMemberExpression") {
          // Handle Namespace.Component (e.g., Modal.Header)
          let current = node.name.object;
          while (current.type === "JSXMemberExpression") {
            current = current.object;
          }
          if (current.type === "JSXIdentifier") {
            componentName = current.name;
          }
        }

        // Skip HTML elements (lowercase) and missing names
        if (!componentName || !/^[A-Z]/.test(componentName)) {
          return;
        }

        // Skip components that aren't imported (might be defined in same file)
        const importSource = importMap.get(componentName);
        if (!importSource) {
          return;
        }

        componentUsages.push({
          node,
          componentName,
          importSource,
        });
      },

      "Program:exit"() {
        const filename = context.filename || context.getFilename();

        for (const usage of componentUsages) {
          const libraryInfo = getComponentLibrary(
            filename,
            usage.componentName,
            usage.importSource
          );

          // Case 1: Direct import from non-preferred library
          if (libraryInfo.library && libraryInfo.library !== preferred) {
            context.report({
              node: usage.node,
              messageId: "nonPreferredLibrary",
              data: {
                component: usage.componentName,
                library: libraryInfo.library,
                preferred,
              },
            });
            continue;
          }

          // Case 2: Local component that uses non-preferred library internally
          if (
            libraryInfo.isLocalComponent &&
            libraryInfo.internalLibraries.size > 0
          ) {
            const nonPreferredLibs = [...libraryInfo.internalLibraries].filter(
              (lib) => lib !== preferred
            );

            if (nonPreferredLibs.length > 0) {
              // Get evidence of which internal components caused the violation
              const internalComponents = libraryInfo.libraryEvidence
                .filter((e) => e.library !== preferred)
                .map((e) => e.componentName)
                .slice(0, 3) // Limit to first 3 for readability
                .join(", ");

              context.report({
                node: usage.node,
                messageId: "transitiveNonPreferred",
                data: {
                  component: usage.componentName,
                  libraries: nonPreferredLibs.join(", "),
                  internalComponents: internalComponents || "unknown",
                  preferred,
                },
              });
            }
          }
        }
      },
    };
  },
});
