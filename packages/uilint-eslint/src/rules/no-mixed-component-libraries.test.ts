/**
 * Tests for: no-mixed-component-libraries
 *
 * Tests the detection of non-preferred UI component libraries at JSX usage sites.
 */

import { RuleTester } from "@typescript-eslint/rule-tester";
import { describe, it, afterAll, beforeEach } from "vitest";
import rule from "./no-mixed-component-libraries.js";
import { clearCache as clearImportGraphCache } from "../utils/import-graph.js";

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

// Clear cache between tests
beforeEach(() => {
  clearImportGraphCache();
});

ruleTester.run("no-mixed-component-libraries", rule, {
  valid: [
    // ============================================
    // USING PREFERRED LIBRARY (shadcn)
    // ============================================
    {
      name: "using shadcn Button (preferred)",
      code: `
        import { Button } from "@/components/ui/button";
        export default function Page() {
          return <Button>Click me</Button>;
        }
      `,
      options: [{ preferred: "shadcn" }],
    },
    {
      name: "using multiple shadcn components",
      code: `
        import { Button } from "@/components/ui/button";
        import { Card, CardContent } from "@/components/ui/card";
        export default function Page() {
          return (
            <Card>
              <CardContent>
                <Button>Click</Button>
              </CardContent>
            </Card>
          );
        }
      `,
      options: [{ preferred: "shadcn" }],
    },
    {
      name: "using radix-ui (part of shadcn)",
      code: `
        import { Dialog } from "@radix-ui/react-dialog";
        export default function Page() {
          return <Dialog />;
        }
      `,
      options: [{ preferred: "shadcn" }],
    },

    // ============================================
    // USING PREFERRED LIBRARY (mui)
    // ============================================
    {
      name: "using MUI Button when MUI is preferred",
      code: `
        import { Button } from "@mui/material";
        export default function Page() {
          return <Button>Click me</Button>;
        }
      `,
      options: [{ preferred: "mui" }],
    },
    {
      name: "using MUI icons when MUI is preferred",
      code: `
        import { Add } from "@mui/icons-material";
        export default function Page() {
          return <Add />;
        }
      `,
      options: [{ preferred: "mui" }],
    },

    // ============================================
    // NO COMPONENT LIBRARY (just HTML/custom)
    // ============================================
    {
      name: "using HTML elements only",
      code: `
        export default function Page() {
          return (
            <div>
              <button>Click</button>
              <span>Text</span>
            </div>
          );
        }
      `,
      options: [{ preferred: "shadcn" }],
    },
    {
      name: "using local components without library imports",
      code: `
        import { MyButton } from "./my-button";
        export default function Page() {
          return <MyButton>Click</MyButton>;
        }
      `,
      options: [{ preferred: "shadcn" }],
    },

    // ============================================
    // COMPONENTS NOT IN IMPORT MAP
    // ============================================
    {
      name: "component defined in same file",
      code: `
        function LocalButton({ children }) {
          return <button>{children}</button>;
        }
        export default function Page() {
          return <LocalButton>Click</LocalButton>;
        }
      `,
      options: [{ preferred: "shadcn" }],
    },
  ],

  invalid: [
    // ============================================
    // DIRECT USAGE OF NON-PREFERRED LIBRARY
    // ============================================
    {
      name: "using MUI when shadcn is preferred",
      code: `
        import { Button } from "@mui/material";
        export default function Page() {
          return <Button>Click me</Button>;
        }
      `,
      options: [{ preferred: "shadcn" }],
      errors: [
        {
          messageId: "nonPreferredLibrary",
          data: {
            component: "Button",
            library: "mui",
            preferred: "shadcn",
          },
        },
      ],
    },
    {
      name: "using Chakra when shadcn is preferred",
      code: `
        import { Box } from "@chakra-ui/react";
        export default function Page() {
          return <Box>Content</Box>;
        }
      `,
      options: [{ preferred: "shadcn" }],
      errors: [
        {
          messageId: "nonPreferredLibrary",
          data: {
            component: "Box",
            library: "chakra",
            preferred: "shadcn",
          },
        },
      ],
    },
    {
      name: "using Ant Design when MUI is preferred",
      code: `
        import { Button } from "antd";
        export default function Page() {
          return <Button>Click me</Button>;
        }
      `,
      options: [{ preferred: "mui" }],
      errors: [
        {
          messageId: "nonPreferredLibrary",
          data: {
            component: "Button",
            library: "antd",
            preferred: "mui",
          },
        },
      ],
    },
    {
      name: "using shadcn when MUI is preferred",
      code: `
        import { Button } from "@/components/ui/button";
        export default function Page() {
          return <Button>Click</Button>;
        }
      `,
      options: [{ preferred: "mui" }],
      errors: [
        {
          messageId: "nonPreferredLibrary",
          data: {
            component: "Button",
            library: "shadcn",
            preferred: "mui",
          },
        },
      ],
    },

    // ============================================
    // MULTIPLE VIOLATIONS IN SAME FILE
    // ============================================
    {
      name: "multiple MUI components when shadcn is preferred",
      code: `
        import { Button, Card, Typography } from "@mui/material";
        export default function Page() {
          return (
            <Card>
              <Typography>Title</Typography>
              <Button>Click</Button>
            </Card>
          );
        }
      `,
      options: [{ preferred: "shadcn" }],
      errors: [
        {
          messageId: "nonPreferredLibrary",
          data: { component: "Card", library: "mui", preferred: "shadcn" },
        },
        {
          messageId: "nonPreferredLibrary",
          data: {
            component: "Typography",
            library: "mui",
            preferred: "shadcn",
          },
        },
        {
          messageId: "nonPreferredLibrary",
          data: { component: "Button", library: "mui", preferred: "shadcn" },
        },
      ],
    },

    // ============================================
    // MIXING PREFERRED WITH NON-PREFERRED
    // ============================================
    {
      name: "mixing shadcn and MUI in same file",
      code: `
        import { Button } from "@/components/ui/button";
        import { Card } from "@mui/material";
        export default function Page() {
          return (
            <Card>
              <Button>Click</Button>
            </Card>
          );
        }
      `,
      options: [{ preferred: "shadcn" }],
      errors: [
        {
          messageId: "nonPreferredLibrary",
          data: { component: "Card", library: "mui", preferred: "shadcn" },
        },
      ],
    },

    // ============================================
    // JSX MEMBER EXPRESSIONS (e.g., Modal.Header)
    // ============================================
    {
      name: "MUI namespace usage (Modal.Header pattern)",
      code: `
        import * as MUI from "@mui/material";
        export default function Page() {
          return <MUI.Button>Click</MUI.Button>;
        }
      `,
      options: [{ preferred: "shadcn" }],
      errors: [
        {
          messageId: "nonPreferredLibrary",
          data: { component: "MUI", library: "mui", preferred: "shadcn" },
        },
      ],
    },

    // ============================================
    // ALIASED IMPORTS
    // ============================================
    {
      name: "aliased MUI import",
      code: `
        import { Button as MuiButton } from "@mui/material";
        export default function Page() {
          return <MuiButton>Click</MuiButton>;
        }
      `,
      options: [{ preferred: "shadcn" }],
      errors: [
        {
          messageId: "nonPreferredLibrary",
          data: { component: "MuiButton", library: "mui", preferred: "shadcn" },
        },
      ],
    },

    // ============================================
    // ICONS FROM NON-PREFERRED LIBRARY
    // ============================================
    {
      name: "using MUI icons when shadcn is preferred",
      code: `
        import { Add, Delete } from "@mui/icons-material";
        export default function Page() {
          return (
            <div>
              <Add />
              <Delete />
            </div>
          );
        }
      `,
      options: [{ preferred: "shadcn" }],
      errors: [
        {
          messageId: "nonPreferredLibrary",
          data: { component: "Add", library: "mui", preferred: "shadcn" },
        },
        {
          messageId: "nonPreferredLibrary",
          data: { component: "Delete", library: "mui", preferred: "shadcn" },
        },
      ],
    },

    // ============================================
    // ANT DESIGN ICONS
    // ============================================
    {
      name: "using Ant Design icons when shadcn is preferred",
      code: `
        import { PlusOutlined } from "@ant-design/icons";
        export default function Page() {
          return <PlusOutlined />;
        }
      `,
      options: [{ preferred: "shadcn" }],
      errors: [
        {
          messageId: "nonPreferredLibrary",
          data: {
            component: "PlusOutlined",
            library: "antd",
            preferred: "shadcn",
          },
        },
      ],
    },
  ],
});
