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
      "uilint/no-mixed-component-libraries": [
        "error",
        {
          libraries: ["shadcn", "mui"],
        },
      ],
    },
  },
];
