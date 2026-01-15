/**
 * Rule: require-input-validation
 *
 * Requires API route handlers to validate request body using schema validation
 * libraries like Zod, Yup, or Joi before accessing request data.
 *
 * Examples:
 * - Bad: const { name } = await req.json()
 * - Good: const data = schema.parse(await req.json())
 */

import { createRule, defineRuleMeta } from "../utils/create-rule.js";
import type { TSESTree } from "@typescript-eslint/utils";

type MessageIds = "missingValidation" | "unvalidatedBodyAccess";
type Options = [
  {
    /** HTTP methods that require validation (default: POST, PUT, PATCH, DELETE) */
    httpMethods?: string[];
    /** File patterns that indicate API routes */
    routePatterns?: string[];
    /** Allow manual type guards/if-checks as validation */
    allowManualValidation?: boolean;
  }
];

/**
 * Rule metadata - colocated with implementation for maintainability
 */
export const meta = defineRuleMeta({
  id: "require-input-validation",
  name: "Require Input Validation",
  description: "Require schema validation in API route handlers",
  defaultSeverity: "warn",
  category: "static",
  defaultOptions: [
    {
      httpMethods: ["POST", "PUT", "PATCH", "DELETE"],
      routePatterns: ["route.ts", "route.tsx", "/api/", "/app/api/"],
      allowManualValidation: false,
    },
  ],
  optionSchema: {
    fields: [
      {
        key: "httpMethods",
        label: "HTTP methods requiring validation",
        type: "multiselect",
        defaultValue: ["POST", "PUT", "PATCH", "DELETE"],
        options: [
          { value: "GET", label: "GET" },
          { value: "POST", label: "POST" },
          { value: "PUT", label: "PUT" },
          { value: "PATCH", label: "PATCH" },
          { value: "DELETE", label: "DELETE" },
        ],
        description: "HTTP methods that require request body validation",
      },
      {
        key: "allowManualValidation",
        label: "Allow manual validation",
        type: "boolean",
        defaultValue: false,
        description: "Allow if-checks and type guards instead of schema validation",
      },
    ],
  },
  docs: `
## What it does

Ensures that API route handlers validate request body data using a schema
validation library (Zod, Yup, Joi, etc.) before accessing it.

## Why it's useful

- **Security**: Prevents injection attacks and malformed data
- **Type Safety**: Ensures runtime data matches expected types
- **Error Handling**: Provides clear validation error messages
- **Best Practice**: Follows defense-in-depth principles

## Supported Validation Libraries

- Zod: \`parse()\`, \`safeParse()\`, \`parseAsync()\`
- Yup: \`validate()\`, \`validateSync()\`
- Joi: \`validate()\`
- Superstruct: \`create()\`, \`assert()\`
- io-ts: \`decode()\`
- Valibot: \`parse()\`, \`safeParse()\`

## Examples

### ❌ Incorrect

\`\`\`tsx
// Next.js App Router
export async function POST(request: Request) {
  const body = await request.json();
  // Body accessed without validation
  await db.users.create({ name: body.name });
}

// Next.js Pages API
export default function handler(req, res) {
  const { email } = req.body;  // Unvalidated
  sendEmail(email);
}
\`\`\`

### ✅ Correct

\`\`\`tsx
import { z } from 'zod';

const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const data = CreateUserSchema.parse(body);  // Validated!
  await db.users.create(data);
}
\`\`\`

## Configuration

\`\`\`js
// eslint.config.js
"uilint/require-input-validation": ["warn", {
  httpMethods: ["POST", "PUT", "PATCH", "DELETE"],
  routePatterns: ["route.ts", "/api/"],
  allowManualValidation: false
}]
\`\`\`
`,
});

/**
 * HTTP method names (Next.js App Router style)
 */
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

/**
 * Validation method names from common libraries
 */
const VALIDATION_METHODS = [
  // Zod
  "parse",
  "safeParse",
  "parseAsync",
  "safeParseAsync",
  // Yup
  "validate",
  "validateSync",
  "validateAt",
  "validateSyncAt",
  // Joi
  "validate",
  "validateAsync",
  // Superstruct
  "create",
  "assert",
  // io-ts
  "decode",
  // Valibot
  "parse",
  "safeParse",
  // Generic
  "validateBody",
  "validateRequest",
  "validateInput",
];

/**
 * Check if file matches route patterns
 */
function isApiRouteFile(filename: string, patterns: string[]): boolean {
  return patterns.some((pattern) => filename.includes(pattern));
}

/**
 * Check if a function is an HTTP method handler
 */
function isHttpMethodHandler(
  node: TSESTree.Node,
  methods: string[]
): { isHandler: boolean; method: string | null } {
  // Check export function GET/POST/etc
  if (
    node.type === "ExportNamedDeclaration" &&
    node.declaration?.type === "FunctionDeclaration" &&
    node.declaration.id
  ) {
    const name = node.declaration.id.name.toUpperCase();
    if (methods.includes(name)) {
      return { isHandler: true, method: name };
    }
  }

  // Check export const GET = async () => {}
  if (
    node.type === "ExportNamedDeclaration" &&
    node.declaration?.type === "VariableDeclaration"
  ) {
    for (const decl of node.declaration.declarations) {
      if (decl.id.type === "Identifier") {
        const name = decl.id.name.toUpperCase();
        if (methods.includes(name)) {
          return { isHandler: true, method: name };
        }
      }
    }
  }

  return { isHandler: false, method: null };
}

/**
 * Check if a call expression is a validation call
 */
function isValidationCall(node: TSESTree.CallExpression): boolean {
  // Check method calls: schema.parse(), schema.validate()
  if (
    node.callee.type === "MemberExpression" &&
    node.callee.property.type === "Identifier"
  ) {
    const methodName = node.callee.property.name;

    // Exclude JSON.parse as it's not schema validation
    if (
      node.callee.object.type === "Identifier" &&
      node.callee.object.name === "JSON" &&
      methodName === "parse"
    ) {
      return false;
    }

    return VALIDATION_METHODS.includes(methodName);
  }

  // Check direct calls: validate(schema, data)
  if (node.callee.type === "Identifier") {
    const funcName = node.callee.name;
    return VALIDATION_METHODS.includes(funcName);
  }

  return false;
}

/**
 * Check if a node is a body access pattern
 */
function isBodyAccess(node: TSESTree.Node): {
  isAccess: boolean;
  accessType: string | null;
} {
  // req.body
  if (
    node.type === "MemberExpression" &&
    node.property.type === "Identifier" &&
    node.property.name === "body"
  ) {
    return { isAccess: true, accessType: "req.body" };
  }

  // request.json() or req.json()
  if (
    node.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    node.callee.property.type === "Identifier" &&
    node.callee.property.name === "json"
  ) {
    return { isAccess: true, accessType: "request.json()" };
  }

  // request.formData()
  if (
    node.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    node.callee.property.type === "Identifier" &&
    node.callee.property.name === "formData"
  ) {
    return { isAccess: true, accessType: "request.formData()" };
  }

  // request.text()
  if (
    node.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    node.callee.property.type === "Identifier" &&
    node.callee.property.name === "text"
  ) {
    return { isAccess: true, accessType: "request.text()" };
  }

  return { isAccess: false, accessType: null };
}

/**
 * Track if we're inside a validation context
 */
interface ValidationContext {
  hasValidation: boolean;
  bodyAccessNodes: Array<{ node: TSESTree.Node; accessType: string }>;
}

export default createRule<Options, MessageIds>({
  name: "require-input-validation",
  meta: {
    type: "problem",
    docs: {
      description: "Require schema validation in API route handlers",
    },
    messages: {
      missingValidation:
        "API route handler '{{method}}' accesses request body without validation. Use a schema validation library like Zod.",
      unvalidatedBodyAccess:
        "Accessing '{{accessType}}' without prior validation. Validate the data first using a schema.",
    },
    schema: [
      {
        type: "object",
        properties: {
          httpMethods: {
            type: "array",
            items: { type: "string" },
            description: "HTTP methods that require validation",
          },
          routePatterns: {
            type: "array",
            items: { type: "string" },
            description: "File patterns that indicate API routes",
          },
          allowManualValidation: {
            type: "boolean",
            description: "Allow manual type guards as validation",
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [
    {
      httpMethods: ["POST", "PUT", "PATCH", "DELETE"],
      routePatterns: ["route.ts", "route.tsx", "/api/", "/app/api/"],
      allowManualValidation: false,
    },
  ],
  create(context) {
    const options = context.options[0] || {};
    const httpMethods = (options.httpMethods ?? ["POST", "PUT", "PATCH", "DELETE"]).map(
      (m) => m.toUpperCase()
    );
    const routePatterns = options.routePatterns ?? [
      "route.ts",
      "route.tsx",
      "/api/",
      "/app/api/",
    ];

    const filename = context.filename || context.getFilename?.() || "";

    // Only check API route files
    if (!isApiRouteFile(filename, routePatterns)) {
      return {};
    }

    // Track handlers and their validation status
    const handlerContexts = new Map<TSESTree.Node, ValidationContext>();
    let currentHandler: TSESTree.Node | null = null;
    let currentMethod: string | null = null;

    return {
      // Detect HTTP method handlers
      ExportNamedDeclaration(node) {
        const { isHandler, method } = isHttpMethodHandler(node, httpMethods);
        if (isHandler) {
          currentHandler = node;
          currentMethod = method;
          handlerContexts.set(node, {
            hasValidation: false,
            bodyAccessNodes: [],
          });
        }
      },

      // Track body access within handlers
      MemberExpression(node) {
        if (!currentHandler) return;

        const ctx = handlerContexts.get(currentHandler);
        if (!ctx) return;

        const { isAccess, accessType } = isBodyAccess(node);
        if (isAccess && accessType) {
          ctx.bodyAccessNodes.push({ node, accessType });
        }
      },

      CallExpression(node) {
        if (!currentHandler) return;

        const ctx = handlerContexts.get(currentHandler);
        if (!ctx) return;

        // Check for body access
        const { isAccess, accessType } = isBodyAccess(node);
        if (isAccess && accessType) {
          // Check if this is inside a validation call
          // e.g., schema.parse(await request.json())
          if (
            node.parent?.type === "AwaitExpression" &&
            node.parent.parent?.type === "CallExpression" &&
            isValidationCall(node.parent.parent)
          ) {
            ctx.hasValidation = true;
            return;
          }

          // Check if this is directly wrapped in validation
          if (
            node.parent?.type === "CallExpression" &&
            isValidationCall(node.parent)
          ) {
            ctx.hasValidation = true;
            return;
          }

          ctx.bodyAccessNodes.push({ node, accessType });
        }

        // Check for validation calls
        if (isValidationCall(node)) {
          ctx.hasValidation = true;
        }
      },

      "ExportNamedDeclaration:exit"(node: TSESTree.ExportNamedDeclaration) {
        const ctx = handlerContexts.get(node);
        if (!ctx) return;

        // If we have body access but no validation, report
        if (ctx.bodyAccessNodes.length > 0 && !ctx.hasValidation) {
          // Report on the first body access
          const firstAccess = ctx.bodyAccessNodes[0];
          context.report({
            node: firstAccess.node,
            messageId: "unvalidatedBodyAccess",
            data: {
              accessType: firstAccess.accessType,
            },
          });
        }

        // Clean up
        if (currentHandler === node) {
          currentHandler = null;
          currentMethod = null;
        }
        handlerContexts.delete(node);
      },
    };
  },
});
