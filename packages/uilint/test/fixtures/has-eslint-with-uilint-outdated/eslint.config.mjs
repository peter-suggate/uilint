import uilint from "uilint-eslint";

export default [
  {
    plugins: {
      uilint: uilint.plugin,
    },
    rules: {
      "uilint/prefer-tailwind": ["warn", { scale: [0, 1, 2, 3, 4, 5, 6, 8] }],
    },
  },
];
