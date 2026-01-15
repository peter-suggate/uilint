/**
 * Tests for: require-input-validation
 *
 * Tests the enforcement of schema validation in API route handlers.
 */

import { RuleTester } from "@typescript-eslint/rule-tester";
import { describe, it, afterAll } from "vitest";
import rule from "./require-input-validation.js";

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

// Test with filename that matches route pattern
const routeFilename = "/app/api/users/route.ts";

ruleTester.run("require-input-validation", rule, {
  valid: [
    // ============================================
    // ZOD VALIDATION
    // ============================================
    {
      name: "Zod schema.parse() validation",
      code: `
        export async function POST(request) {
          const body = await request.json();
          const data = schema.parse(body);
          return Response.json(data);
        }
      `,
      filename: routeFilename,
    },
    {
      name: "Zod schema.safeParse() validation",
      code: `
        export async function POST(request) {
          const body = await request.json();
          const result = schema.safeParse(body);
          if (!result.success) return Response.json({ error: result.error });
          return Response.json(result.data);
        }
      `,
      filename: routeFilename,
    },
    {
      name: "Zod inline validation",
      code: `
        export async function POST(request) {
          const data = schema.parse(await request.json());
          return Response.json(data);
        }
      `,
      filename: routeFilename,
    },
    {
      name: "Zod parseAsync validation",
      code: `
        export async function PUT(request) {
          const body = await request.json();
          const data = await schema.parseAsync(body);
          return Response.json(data);
        }
      `,
      filename: routeFilename,
    },

    // ============================================
    // YUP VALIDATION
    // ============================================
    {
      name: "Yup validate() validation",
      code: `
        export async function POST(request) {
          const body = await request.json();
          const data = await schema.validate(body);
          return Response.json(data);
        }
      `,
      filename: routeFilename,
    },
    {
      name: "Yup validateSync() validation",
      code: `
        export async function PATCH(request) {
          const body = await request.json();
          const data = schema.validateSync(body);
          return Response.json(data);
        }
      `,
      filename: routeFilename,
    },

    // ============================================
    // OTHER VALIDATION LIBRARIES
    // ============================================
    {
      name: "Superstruct create() validation",
      code: `
        export async function POST(request) {
          const body = await request.json();
          const data = create(body, UserSchema);
          return Response.json(data);
        }
      `,
      filename: routeFilename,
    },
    {
      name: "Superstruct assert() validation",
      code: `
        export async function DELETE(request) {
          const body = await request.json();
          assert(body, DeleteSchema);
          return Response.json({ deleted: true });
        }
      `,
      filename: routeFilename,
    },
    {
      name: "io-ts decode() validation",
      code: `
        export async function POST(request) {
          const body = await request.json();
          const result = UserCodec.decode(body);
          return Response.json(result);
        }
      `,
      filename: routeFilename,
    },

    // ============================================
    // GET HANDLERS (no body validation needed)
    // ============================================
    {
      name: "GET handler without body access",
      code: `
        export async function GET(request) {
          const { searchParams } = new URL(request.url);
          const id = searchParams.get('id');
          return Response.json({ id });
        }
      `,
      filename: routeFilename,
    },
    {
      name: "GET with URL params only",
      code: `
        export function GET(request, { params }) {
          return Response.json({ userId: params.id });
        }
      `,
      filename: routeFilename,
    },

    // ============================================
    // NON-ROUTE FILES
    // ============================================
    {
      name: "non-route file with POST function",
      code: `
        export async function POST(data) {
          const body = await data.json();
          return body;
        }
      `,
      filename: "/app/components/Form.tsx",
    },
    {
      name: "utility file with body access",
      code: `
        export function processBody(req) {
          return req.body;
        }
      `,
      filename: "/lib/utils.ts",
    },

    // ============================================
    // ARROW FUNCTION HANDLERS WITH VALIDATION
    // ============================================
    {
      name: "arrow function POST with validation",
      code: `
        export const POST = async (request) => {
          const body = await request.json();
          const data = schema.parse(body);
          return Response.json(data);
        };
      `,
      filename: routeFilename,
    },

    // ============================================
    // CUSTOM VALIDATION FUNCTIONS
    // ============================================
    {
      name: "custom validateBody function",
      code: `
        export async function POST(request) {
          const body = await request.json();
          const data = validateBody(body, userSchema);
          return Response.json(data);
        }
      `,
      filename: routeFilename,
    },
    {
      name: "custom validateRequest function",
      code: `
        export async function PUT(request) {
          const data = await validateRequest(request);
          return Response.json(data);
        }
      `,
      filename: routeFilename,
    },

    // ============================================
    // FORMDATA WITH VALIDATION
    // ============================================
    {
      name: "formData with validation",
      code: `
        export async function POST(request) {
          const formData = await request.formData();
          const data = schema.parse(Object.fromEntries(formData));
          return Response.json(data);
        }
      `,
      filename: routeFilename,
    },

    // ============================================
    // REQUEST TEXT WITH VALIDATION
    // ============================================
    {
      name: "text body with validation",
      code: `
        export async function POST(request) {
          const text = await request.text();
          const data = schema.parse(JSON.parse(text));
          return Response.json(data);
        }
      `,
      filename: routeFilename,
    },
  ],

  invalid: [
    // ============================================
    // MISSING VALIDATION - request.json()
    // ============================================
    {
      name: "POST without validation - destructured json",
      code: `
        export async function POST(request) {
          const { name, email } = await request.json();
          return Response.json({ name, email });
        }
      `,
      filename: routeFilename,
      errors: [
        {
          messageId: "unvalidatedBodyAccess",
          data: { accessType: "request.json()" },
        },
      ],
    },
    {
      name: "POST without validation - variable assignment",
      code: `
        export async function POST(request) {
          const body = await request.json();
          const user = createUser(body.name, body.email);
          return Response.json(user);
        }
      `,
      filename: routeFilename,
      errors: [
        {
          messageId: "unvalidatedBodyAccess",
          data: { accessType: "request.json()" },
        },
      ],
    },
    {
      name: "PUT without validation",
      code: `
        export async function PUT(request) {
          const data = await request.json();
          await db.users.update(data);
          return Response.json({ success: true });
        }
      `,
      filename: routeFilename,
      errors: [
        {
          messageId: "unvalidatedBodyAccess",
          data: { accessType: "request.json()" },
        },
      ],
    },
    {
      name: "PATCH without validation",
      code: `
        export async function PATCH(request) {
          const updates = await request.json();
          return Response.json(updates);
        }
      `,
      filename: routeFilename,
      errors: [
        {
          messageId: "unvalidatedBodyAccess",
          data: { accessType: "request.json()" },
        },
      ],
    },
    {
      name: "DELETE without validation",
      code: `
        export async function DELETE(request) {
          const { id } = await request.json();
          await db.users.delete(id);
          return Response.json({ deleted: true });
        }
      `,
      filename: routeFilename,
      errors: [
        {
          messageId: "unvalidatedBodyAccess",
          data: { accessType: "request.json()" },
        },
      ],
    },

    // ============================================
    // MISSING VALIDATION - req.body
    // ============================================
    {
      name: "Pages API route - req.body without validation",
      code: `
        export async function POST(req) {
          const data = req.body;
          return Response.json(data);
        }
      `,
      filename: routeFilename,
      errors: [
        {
          messageId: "unvalidatedBodyAccess",
          data: { accessType: "req.body" },
        },
      ],
    },
    {
      name: "Pages API route - destructured req.body",
      code: `
        export async function POST(req) {
          const { email } = req.body;
          return Response.json({ sent: email });
        }
      `,
      filename: routeFilename,
      errors: [
        {
          messageId: "unvalidatedBodyAccess",
          data: { accessType: "req.body" },
        },
      ],
    },

    // ============================================
    // ARROW FUNCTION HANDLERS WITHOUT VALIDATION
    // ============================================
    {
      name: "arrow function POST without validation",
      code: `
        export const POST = async (request) => {
          const body = await request.json();
          return Response.json(body);
        };
      `,
      filename: routeFilename,
      errors: [
        {
          messageId: "unvalidatedBodyAccess",
          data: { accessType: "request.json()" },
        },
      ],
    },

    // ============================================
    // FORMDATA WITHOUT VALIDATION
    // ============================================
    {
      name: "formData without validation",
      code: `
        export async function POST(request) {
          const formData = await request.formData();
          const name = formData.get('name');
          return Response.json({ name });
        }
      `,
      filename: routeFilename,
      errors: [
        {
          messageId: "unvalidatedBodyAccess",
          data: { accessType: "request.formData()" },
        },
      ],
    },

    // ============================================
    // TEXT BODY WITHOUT VALIDATION
    // ============================================
    {
      name: "text body without validation",
      code: `
        export async function POST(request) {
          const body = await request.text();
          const data = JSON.parse(body);
          return Response.json(data);
        }
      `,
      filename: routeFilename,
      errors: [
        {
          messageId: "unvalidatedBodyAccess",
          data: { accessType: "request.text()" },
        },
      ],
    },

    // ============================================
    // PARTIAL VALIDATION (still invalid)
    // ============================================
    {
      name: "type assertion without runtime validation",
      code: `
        export async function POST(request) {
          const body = await request.json() as UserInput;
          return Response.json(body);
        }
      `,
      filename: routeFilename,
      errors: [
        {
          messageId: "unvalidatedBodyAccess",
          data: { accessType: "request.json()" },
        },
      ],
    },

    // ============================================
    // CUSTOM ROUTE PATTERNS
    // ============================================
    {
      name: "custom route pattern match",
      code: `
        export async function POST(request) {
          const data = await request.json();
          return Response.json(data);
        }
      `,
      filename: "/server/handlers/users.ts",
      options: [{ routePatterns: ["/server/handlers/"] }],
      errors: [
        {
          messageId: "unvalidatedBodyAccess",
          data: { accessType: "request.json()" },
        },
      ],
    },

    // ============================================
    // MULTIPLE BODY ACCESSES (reports first)
    // ============================================
    {
      name: "multiple unvalidated body accesses",
      code: `
        export async function POST(request) {
          const body1 = await request.json();
          const body2 = request.body;
          return Response.json({ body1, body2 });
        }
      `,
      filename: routeFilename,
      errors: [
        {
          messageId: "unvalidatedBodyAccess",
          data: { accessType: "request.json()" },
        },
      ],
    },
  ],
});
