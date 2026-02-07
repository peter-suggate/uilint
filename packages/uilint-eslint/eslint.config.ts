import baseConfig from "../../eslint.config.base.ts";

export default [
  ...baseConfig,
  {
    files: ["src/rules/__fixtures__/**/*.ts", "src/rules/__fixtures__/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
];
