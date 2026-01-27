import uilint from "uilint-eslint";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [".next/**", "node_modules/**"],
  },
  {
    files: ["src/**/*.{js,jsx,ts,tsx}", "app/**/*.{js,jsx,ts,tsx}"],
    plugins: { uilint: uilint },
    languageOptions: {
      parser: tseslint.parser,
    },
    rules: {
      // All static rules
      "uilint/prefer-tailwind": "warn",
      "uilint/consistent-dark-mode": "warn",
      "uilint/no-direct-store-import": "warn",
      "uilint/prefer-zustand-state-management": "warn",
      "uilint/no-mixed-component-libraries": "warn",
      "uilint/enforce-absolute-imports": "warn",
      "uilint/no-any-in-props": "error",
      "uilint/zustand-use-selectors": "warn",
      "uilint/no-prop-drilling-depth": "warn",
      "uilint/no-secrets-in-code": "error",
      "uilint/require-input-validation": "warn",
      "uilint/require-test-coverage": "warn",
      // Semantic rules
      "uilint/semantic": "warn",
      "uilint/semantic-vision": "warn",
      "uilint/no-semantic-duplicates": "warn",
    },
  },
];
