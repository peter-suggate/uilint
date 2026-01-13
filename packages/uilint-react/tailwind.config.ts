import type { Config } from "tailwindcss";

/**
 * Tailwind v4 Configuration for UILint DevTools
 *
 * Note: In Tailwind v4, many options moved to CSS:
 * - Theme customization uses @theme in CSS
 *
 * This config file provides:
 * - Content paths for class detection
 * - Dark mode configuration
 * - Important selector for specificity
 */
const config: Config = {
  // Scope Tailwind utilities to the devtool container to avoid affecting host apps.
  important: ".dev-tool-root",
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}", "./@/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
