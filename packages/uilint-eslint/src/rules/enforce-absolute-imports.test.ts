/**
 * Tests for: enforce-absolute-imports
 *
 * Tests the enforcement of alias imports for deeply nested relative paths.
 */

import { RuleTester } from "@typescript-eslint/rule-tester";
import { describe, it, afterAll } from "vitest";
import rule from "./enforce-absolute-imports.js";

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

ruleTester.run("enforce-absolute-imports", rule, {
  valid: [
    // ============================================
    // SAME DIRECTORY IMPORTS
    // ============================================
    {
      name: "same directory import",
      code: `import { helper } from './helper';`,
    },
    {
      name: "same directory default import",
      code: `import Button from './Button';`,
    },
    {
      name: "same directory with extension",
      code: `import styles from './styles.module.css';`,
    },

    // ============================================
    // SINGLE PARENT DIRECTORY (within default threshold)
    // ============================================
    {
      name: "single parent directory import",
      code: `import { utils } from '../utils';`,
    },
    {
      name: "single parent directory with subdirectory",
      code: `import { Button } from '../components/Button';`,
    },
    {
      name: "single parent with multiple subdirectories",
      code: `import { theme } from '../lib/styles/theme';`,
    },

    // ============================================
    // ALIAS IMPORTS (always valid)
    // ============================================
    {
      name: "alias import with @/",
      code: `import { Button } from '@/components/Button';`,
    },
    {
      name: "alias import with ~/",
      code: `import { utils } from '~/lib/utils';`,
    },
    {
      name: "alias import with @components",
      code: `import { Card } from '@components/Card';`,
    },

    // ============================================
    // NODE MODULES (always valid)
    // ============================================
    {
      name: "node_modules import - react",
      code: `import React from 'react';`,
    },
    {
      name: "node_modules import - lodash",
      code: `import { debounce } from 'lodash';`,
    },
    {
      name: "scoped package import",
      code: `import { Button } from '@mui/material';`,
    },
    {
      name: "subpath import from package",
      code: `import Link from 'next/link';`,
    },

    // ============================================
    // IGNORED PATHS
    // ============================================
    {
      name: "ignored CSS import (deep path)",
      code: `import '../../styles/global.css';`,
      options: [{ ignorePaths: [".css"] }],
    },
    {
      name: "ignored SCSS import (deep path)",
      code: `import '../../styles/theme.scss';`,
      options: [{ ignorePaths: [".scss", ".css"] }],
    },

    // ============================================
    // CUSTOM THRESHOLD
    // ============================================
    {
      name: "two parent directories with maxRelativeDepth: 2",
      code: `import { utils } from '../../lib/utils';`,
      options: [{ maxRelativeDepth: 2 }],
    },
    {
      name: "three parent directories with maxRelativeDepth: 3",
      code: `import { api } from '../../../services/api';`,
      options: [{ maxRelativeDepth: 3 }],
    },

    // ============================================
    // SPECIAL CASES
    // ============================================
    {
      name: "side effect import (same directory)",
      code: `import './polyfill';`,
    },
    {
      name: "namespace import",
      code: `import * as Utils from '../utils';`,
    },
    {
      name: "multiple imports from same source",
      code: `import { a, b, c } from '../helpers';`,
    },
    {
      name: "import with alias",
      code: `import { Button as Btn } from '../components/Button';`,
    },

    // ============================================
    // RE-EXPORTS (within threshold)
    // ============================================
    {
      name: "re-export within threshold",
      code: `export { Button } from '../Button';`,
    },
    {
      name: "export all within threshold",
      code: `export * from '../utils';`,
    },
  ],

  invalid: [
    // ============================================
    // EXCEEDS DEFAULT THRESHOLD (1)
    // ============================================
    {
      name: "two parent directories (exceeds default threshold)",
      code: `import { Button } from '../../components/Button';`,
      errors: [
        {
          messageId: "preferAbsoluteImport",
          data: {
            depth: "2",
            plural: "ies",
            aliasPrefix: "@/",
            importSource: "../../components/Button",
          },
        },
      ],
    },
    {
      name: "three parent directories",
      code: `import { utils } from '../../../lib/utils';`,
      errors: [
        {
          messageId: "preferAbsoluteImport",
          data: {
            depth: "3",
            plural: "ies",
            aliasPrefix: "@/",
            importSource: "../../../lib/utils",
          },
        },
      ],
    },
    {
      name: "four parent directories",
      code: `import { api } from '../../../../services/api';`,
      errors: [
        {
          messageId: "preferAbsoluteImport",
          data: {
            depth: "4",
            plural: "ies",
            aliasPrefix: "@/",
            importSource: "../../../../services/api",
          },
        },
      ],
    },

    // ============================================
    // VARIOUS IMPORT STYLES
    // ============================================
    {
      name: "default import with deep path",
      code: `import Button from '../../components/ui/Button';`,
      errors: [
        {
          messageId: "preferAbsoluteImport",
          data: {
            depth: "2",
            plural: "ies",
            aliasPrefix: "@/",
            importSource: "../../components/ui/Button",
          },
        },
      ],
    },
    {
      name: "namespace import with deep path",
      code: `import * as Utils from '../../lib/utils';`,
      errors: [
        {
          messageId: "preferAbsoluteImport",
          data: {
            depth: "2",
            plural: "ies",
            aliasPrefix: "@/",
            importSource: "../../lib/utils",
          },
        },
      ],
    },
    {
      name: "multiple named imports with deep path",
      code: `import { a, b, c } from '../../helpers/index';`,
      errors: [
        {
          messageId: "preferAbsoluteImport",
          data: {
            depth: "2",
            plural: "ies",
            aliasPrefix: "@/",
            importSource: "../../helpers/index",
          },
        },
      ],
    },

    // ============================================
    // RE-EXPORTS EXCEEDING THRESHOLD
    // ============================================
    {
      name: "re-export with deep path",
      code: `export { Button } from '../../components/Button';`,
      errors: [
        {
          messageId: "preferAbsoluteImport",
          data: {
            depth: "2",
            plural: "ies",
            aliasPrefix: "@/",
            importSource: "../../components/Button",
          },
        },
      ],
    },
    {
      name: "export all with deep path",
      code: `export * from '../../utils';`,
      errors: [
        {
          messageId: "preferAbsoluteImport",
          data: {
            depth: "2",
            plural: "ies",
            aliasPrefix: "@/",
            importSource: "../../utils",
          },
        },
      ],
    },

    // ============================================
    // MULTIPLE VIOLATIONS IN ONE FILE
    // ============================================
    {
      name: "multiple violations",
      code: `
        import { Button } from '../../components/Button';
        import { Card } from '../../../components/Card';
        import { utils } from '../../lib/utils';
      `,
      errors: [
        {
          messageId: "preferAbsoluteImport",
          data: {
            depth: "2",
            plural: "ies",
            aliasPrefix: "@/",
            importSource: "../../components/Button",
          },
        },
        {
          messageId: "preferAbsoluteImport",
          data: {
            depth: "3",
            plural: "ies",
            aliasPrefix: "@/",
            importSource: "../../../components/Card",
          },
        },
        {
          messageId: "preferAbsoluteImport",
          data: {
            depth: "2",
            plural: "ies",
            aliasPrefix: "@/",
            importSource: "../../lib/utils",
          },
        },
      ],
    },

    // ============================================
    // CUSTOM THRESHOLD VIOLATIONS
    // ============================================
    {
      name: "single parent with maxRelativeDepth: 0",
      code: `import { utils } from '../utils';`,
      options: [{ maxRelativeDepth: 0 }],
      errors: [
        {
          messageId: "preferAbsoluteImport",
          data: {
            depth: "1",
            plural: "y",
            aliasPrefix: "@/",
            importSource: "../utils",
          },
        },
      ],
    },
    {
      name: "three parents with maxRelativeDepth: 2",
      code: `import { api } from '../../../services/api';`,
      options: [{ maxRelativeDepth: 2 }],
      errors: [
        {
          messageId: "preferAbsoluteImport",
          data: {
            depth: "3",
            plural: "ies",
            aliasPrefix: "@/",
            importSource: "../../../services/api",
          },
        },
      ],
    },

    // ============================================
    // CUSTOM ALIAS PREFIX
    // ============================================
    {
      name: "custom alias prefix in message",
      code: `import { Button } from '../../components/Button';`,
      options: [{ aliasPrefix: "~/" }],
      errors: [
        {
          messageId: "preferAbsoluteImport",
          data: {
            depth: "2",
            plural: "ies",
            aliasPrefix: "~/",
            importSource: "../../components/Button",
          },
        },
      ],
    },

    // ============================================
    // SIDE EFFECT IMPORTS
    // ============================================
    {
      name: "side effect import with deep path",
      code: `import '../../styles/init';`,
      errors: [
        {
          messageId: "preferAbsoluteImport",
          data: {
            depth: "2",
            plural: "ies",
            aliasPrefix: "@/",
            importSource: "../../styles/init",
          },
        },
      ],
    },

    // ============================================
    // MIXED VALID AND INVALID
    // ============================================
    {
      name: "file with mixed valid and invalid imports",
      code: `
        import React from 'react';
        import { Button } from '@/components/Button';
        import { utils } from '../utils';
        import { deep } from '../../lib/deep';
      `,
      errors: [
        {
          messageId: "preferAbsoluteImport",
          data: {
            depth: "2",
            plural: "ies",
            aliasPrefix: "@/",
            importSource: "../../lib/deep",
          },
        },
      ],
    },
  ],
});
