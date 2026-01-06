/**
 * Rule: no-direct-store-import
 *
 * Forbids direct Zustand store imports - prefer using hooks via context.
 */

import { createRule } from "../utils/create-rule.js";

type MessageIds = "noDirectImport";
type Options = [
  {
    storePattern?: string;
  }
];

// Convert glob pattern to regex
function patternToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`);
}

export default createRule<Options, MessageIds>({
  name: "no-direct-store-import",
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid direct Zustand store imports (use hooks via context)",
    },
    messages: {
      noDirectImport:
        "Avoid importing store '{{name}}' directly. Use the store via a context hook instead.",
    },
    schema: [
      {
        type: "object",
        properties: {
          storePattern: {
            type: "string",
            description: "Glob pattern for store names",
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [{ storePattern: "use*Store" }],
  create(context) {
    const options = context.options[0] || {};
    const pattern = options.storePattern || "use*Store";
    const regex = patternToRegex(pattern);

    return {
      ImportDeclaration(node) {
        // Check if importing from a store file
        const source = node.source.value as string;
        if (!source.includes("store")) return;

        // Check imported specifiers
        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportSpecifier") {
            const importedName =
              specifier.imported.type === "Identifier"
                ? specifier.imported.name
                : specifier.imported.value;

            if (regex.test(importedName)) {
              context.report({
                node: specifier,
                messageId: "noDirectImport",
                data: { name: importedName },
              });
            }
          }

          if (specifier.type === "ImportDefaultSpecifier") {
            const localName = specifier.local.name;
            if (regex.test(localName)) {
              context.report({
                node: specifier,
                messageId: "noDirectImport",
                data: { name: localName },
              });
            }
          }
        }
      },
    };
  },
});
