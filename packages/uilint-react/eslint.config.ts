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
  {
    files: [
      "src/**/*.{js,jsx,ts,tsx}",
      "app/**/*.{js,jsx,ts,tsx}",
      "pages/**/*.{js,jsx,ts,tsx}",
    ],

    plugins: { uilint: uilint },

    rules: {
      "react/react-in-jsx-scope": "off",
      "uilint/no-arbitrary-tailwind": "off",
      "uilint/consistent-dark-mode": [
        "warn",
        ...[
          {
            warnOnMissingDarkMode: true,
          },
        ],
      ],
      "uilint/no-direct-store-import": [
        "warn",
        ...[
          {
            storePattern: "use*Store",
          },
        ],
      ],
      "uilint/prefer-zustand-state-management": [
        "warn",
        ...[
          {
            maxStateHooks: 5,
            countUseState: true,
            countUseReducer: true,
            countUseContext: true,
          },
        ],
      ],
      "uilint/no-mixed-component-libraries": [
        "warn",
        ...[
          {
            preferred: "shadcn",
            libraries: ["shadcn", "mui"],
          },
        ],
      ],
    },
  },
]);
