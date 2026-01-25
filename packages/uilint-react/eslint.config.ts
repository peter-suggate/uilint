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
      // Test coverage tracking - require coverage for all code including components
      "uilint/require-test-coverage": [
        "warn",
        {
          chunkCoverage: true,
          focusNonReact: false, // Apply same threshold to components
          chunkThreshold: 70, // 70% for all code including components
          ignorePatterns: ["**/*.d.ts", "**/index.ts", "**/__tests__/**"],
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
      "uilint/no-arbitrary-tailwind": "off",
    },
  },
]);
