import uilint from "uilint-eslint";
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import { defineConfig } from "eslint/config";

export default defineConfig([
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
      // Test coverage tracking - focus on non-React code (utilities/stores/hooks)
      "uilint/require-test-coverage": [
        "warn",
        {
          chunkCoverage: true,
          focusNonReact: true,
          chunkThreshold: 70, // Strict for utilities/stores/hooks
          relaxedThreshold: 40, // Relaxed for components/handlers
          ignorePatterns: ["**/*.d.ts", "**/index.ts", "**/__tests__/**"],
        },
      ],
      // Allow underscore prefix for unused vars (destructuring patterns)
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]);
