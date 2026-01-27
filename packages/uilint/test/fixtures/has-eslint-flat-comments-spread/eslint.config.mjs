import next from "@next/eslint-plugin-next";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [".next/**", "node_modules/**"],
  },
  {
    files: ["src/**/*.{js,jsx,ts,tsx}", "app/**/*.{js,jsx,ts,tsx}"],
    plugins: {
      "@next/next": next,
    },
    rules: {
      // Keep this comment. We want AST transforms to preserve it.
      ...next.configs.recommended.rules,

      // These are commented-out uilint rules and should NOT be treated as configured.
      // "uilint/consistent-dark-mode": "warn",
      // "uilint/prefer-tailwind": ["warn", ...[{ "scale": [0, 1, 2] }]],
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
];
