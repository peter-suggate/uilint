import uilint from "uilint-eslint";
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import { defineConfig } from "eslint/config";

// Configure React plugin settings
pluginReact.configs.flat.recommended.settings = {
  ...pluginReact.configs.flat.recommended.settings,
  react: { version: "detect" },
};

export default defineConfig([
  {
    ignores: ["dist/**", "dist"],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: { globals: globals.browser },
  },
  tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  // UILint recommended config - all 12 static rules with defaults
  uilint.configs.recommended,
  {
    files: [
      "src/**/*.{js,jsx,ts,tsx}",
      "app/**/*.{js,jsx,ts,tsx}",
      "pages/**/*.{js,jsx,ts,tsx}",
    ],
    rules: {
      "react/react-in-jsx-scope": "off",
      // Allow deeper relative imports - src/ doesn't have @/ alias configured
      "uilint/enforce-absolute-imports": ["warn", { maxRelativeDepth: 4 }],
      // Internal store pattern is valid for this package
      "uilint/no-direct-store-import": "off",
      // Test coverage tracking - low threshold for clean slate, increase as coverage improves
      // Current coverage: ~60% lines, ~59% functions
      "uilint/require-test-coverage": [
        "warn",
        {
          chunkCoverage: true,
          focusNonReact: false,
          threshold: 1, // Require at least some coverage
          chunkThreshold: 1,
          jsxThreshold: 1,
          aggregateThreshold: 1,
          ignorePatterns: [
            "**/*.d.ts",
            "**/index.ts",
            "**/__tests__/**",
            // Hooks are often better tested through component integration tests
            "**/hooks/useAdaptiveText*.ts",
            "**/hooks/useElementRects*.ts",
            "**/hooks/useFullSourceCode*.ts",
            "**/hooks/useIssues*.ts",
            // Layout utilities are pure functions better tested visually
            "**/layout/mosaic-layout.ts",
            // Animation utilities are visual and hard to unit test meaningfully
            "**/animations/*.ts",
            // Provider components need integration tests
            "**/*Provider.tsx",
            // Adapters are bridge code tested through integration
            "**/*Adapter.tsx",
            // Service modules need integration tests with real dependencies
            "**/services/manifest-fetcher.ts",
            "**/services/source-cache.ts",
            // Some tile-related files need more complex test setups
            "**/tile-selectors.ts",
            // Plugin providers with complex dependencies
            "**/tile-provider.ts",
            "**/static-handler.ts",
          ],
        },
      ],
      // Allow underscore prefix for unused vars (destructuring patterns)
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Prefer semantic colors over hard-coded Tailwind colors
      "uilint/prefer-tailwind": [
        "warn",
        {
          preferSemanticColors: true,
          // Allow gray for neutral UI elements
          allowedHardCodedColors: ["gray"],
        },
      ],
    },
  },
  // Disable UI-specific rules for overlay/devtool components
  // These components are devtool overlays that:
  // - Use inline styles for dynamic positioning
  // - Don't need dark mode (always rendered on top of user's page)
  // - Use precise pixel sizing for devtool UI
  {
    files: [
      "src/consistency/highlights.tsx",
      "src/ui/components/**/*.tsx",
      "src/plugins/**/panels/**/*.tsx",
    ],
    rules: {
      "uilint/prefer-tailwind": "off",
      "uilint/consistent-dark-mode": "off",
    },
  },
  // Test file specific rules
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      // Allow require() for mocking modules in tests
      "@typescript-eslint/no-require-imports": "off",
      // Display names not needed for test mock components
      "react/display-name": "off",
      // Skip coverage checks for test files themselves
      "uilint/require-test-coverage": "off",
    },
  },
  // Store composition requires type casting for Zustand slice composition
  {
    files: ["src/core/store/composed-store.ts"],
    rules: {
      "uilint/no-unsafe-type-casts": "off",
    },
  },
  // Tile components use 'children' as a data prop for child tiles (not React children)
  // This is a naming choice for the tile hierarchy API
  {
    files: [
      "src/ui/components/CommandPalette/ExpandableTile.tsx",
      "src/ui/components/CommandPalette/ExpandableTileGrid.tsx",
      "src/ui/components/HierarchicalTiles/ExpandableContainer.tsx",
      "src/ui/components/HierarchicalTiles/ExpandableTileGrid.tsx",
    ],
    rules: {
      "react/no-children-prop": "off",
    },
  },
]);
