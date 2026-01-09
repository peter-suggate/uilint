import tseslint from "typescript-eslint";

export default [
  {
    ignores: [".next/**", "node_modules/**"],
  },
  {
    files: ["app/**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
    },
    rules: {},
  },
];
