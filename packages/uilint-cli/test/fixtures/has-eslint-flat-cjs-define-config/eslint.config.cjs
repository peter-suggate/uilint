const { defineConfig } = require("eslint/config");
const next = require("@next/eslint-plugin-next");
const tseslint = require("typescript-eslint");

module.exports = defineConfig([
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
    },
    languageOptions: {
      parser: tseslint.parser,
    },
  },
]);
