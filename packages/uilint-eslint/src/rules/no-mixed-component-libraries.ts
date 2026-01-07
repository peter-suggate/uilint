/**
 * Rule: no-mixed-component-libraries
 *
 * Forbids mixing shadcn/ui and MUI components in the same file.
 */

import type { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";

type MessageIds = "mixedLibraries" | "nonPreferredLibrary";
type LibraryName = "shadcn" | "mui";
type Options = [
  {
    libraries?: LibraryName[];
    preferred?: LibraryName;
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
      nonPreferredLibrary:
        "Using {{lib}} components, but {{preferred}} is the preferred library. Use {{preferred}} instead.",
    },
    schema: [
      {
        type: "object",
        properties: {
          libraries: {
            type: "array",
            items: { type: "string", enum: ["shadcn", "mui"] },
          },
          preferred: {
            type: "string",
            enum: ["shadcn", "mui"],
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
    const preferred = options.preferred as LibraryName | undefined;
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
        // Check for mixing libraries (existing behavior)
        if (detected.size > 1) {
          const libs = [...detected.keys()];
          const secondLib = libs[1]!;
          const secondNode = detected.get(secondLib)!;

          context.report({
            node: secondNode,
            messageId: "mixedLibraries",
            data: { lib1: libs[0], lib2: secondLib },
          });
          return;
        }

        // Check for non-preferred library usage
        if (preferred && detected.size === 1) {
          const usedLib = [...detected.keys()][0];
          if (usedLib && usedLib !== preferred) {
            const node = detected.get(usedLib)!;
            context.report({
              node,
              messageId: "nonPreferredLibrary",
              data: { lib: usedLib, preferred },
            });
          }
        }
      },
    };
  },
});
