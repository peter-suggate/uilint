import next from "@next/eslint-plugin-next";
import uilint from "uilint-eslint";
import tseslint from "typescript-eslint";

export default [
  {
    files: [
      "src/**/*.{js,jsx,ts,tsx}",
      "app/**/*.{js,jsx,ts,tsx}",
      "pages/**/*.{js,jsx,ts,tsx}",
    ],
    plugins: {
      "@next/next": next,
    },
    rules: {
      ...next.configs.recommended.rules,
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
    settings: {
      next: {
        rootDir: true, // Configures the root directory for the Next.js plugin
      },
    },
  },
  {
    files: [
      "src/**/*.{js,jsx,ts,tsx}",
      "app/**/*.{js,jsx,ts,tsx}",
      "pages/**/*.{js,jsx,ts,tsx}",
    ],
    plugins: { uilint: uilint },
    rules: {
      "uilint/no-arbitrary-tailwind": "error",
      "uilint/consistent-spacing": [
        "warn",
        { scale: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16] },
      ],
      "uilint/no-direct-store-import": ["error", { storePattern: "use*Store" }],
      "uilint/no-mixed-component-libraries": [
        "error",
        { libraries: ["shadcn", "mui"] },
      ],
      "uilint/semantic": [
        "warn",
        { model: "qwen3-coder:30b", styleguidePath: ".uilint/styleguide.md" },
      ],
    },
  },
];
