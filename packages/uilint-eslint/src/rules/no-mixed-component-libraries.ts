/**
 * Rule: no-mixed-component-libraries
 *
 * Forbids mixing shadcn/ui and MUI components in the same file.
 */

import type { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";

type MessageIds = "mixedLibraries";
type LibraryName = "shadcn" | "mui";
type Options = [
  {
    libraries?: LibraryName[];
  }
];

const LIBRARY_PATTERNS: Record<LibraryName, string[]> = {
  shadcn: ["@/components/ui", "@radix-ui/", "components/ui/"],
  mui: ["@mui/material", "@mui/icons-material", "@emotion/"],
};

export default createRule<Options, MessageIds>({
  name: "no-mixed-component-libraries",
  meta: {
    type: "problem",
    docs: {
      description: "Forbid mixing component libraries in the same file",
    },
    messages: {
      mixedLibraries:
        "Mixing {{lib1}} and {{lib2}} components. Choose one library per file.",
    },
    schema: [
      {
        type: "object",
        properties: {
          libraries: {
            type: "array",
            items: { type: "string", enum: ["shadcn", "mui"] },
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [{ libraries: ["shadcn", "mui"] }],
  create(context) {
    const options = context.options[0] || {};
    const libraries = (options.libraries || ["shadcn", "mui"]) as LibraryName[];
    const detected: Map<LibraryName, TSESTree.ImportDeclaration> = new Map();

    return {
      ImportDeclaration(node) {
        const source = node.source.value as string;

        for (const lib of libraries) {
          const patterns = LIBRARY_PATTERNS[lib];
          if (patterns?.some((p) => source.includes(p))) {
            if (!detected.has(lib)) {
              detected.set(lib, node);
            }
          }
        }
      },

      "Program:exit"() {
        if (detected.size > 1) {
          const libs = [...detected.keys()];
          const secondLib = libs[1]!;
          const secondNode = detected.get(secondLib)!;

          context.report({
            node: secondNode,
            messageId: "mixedLibraries",
            data: { lib1: libs[0], lib2: secondLib },
          });
        }
      },
    };
  },
});
