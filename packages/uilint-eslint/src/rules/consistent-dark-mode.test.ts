/**
 * Tests for: consistent-dark-mode
 *
 * Ensures consistent dark mode theming in Tailwind CSS classes.
 */

import { RuleTester } from "@typescript-eslint/rule-tester";
import { describe, it, afterAll } from "vitest";
import rule from "./consistent-dark-mode.js";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

ruleTester.run("consistent-dark-mode", rule, {
  valid: [
    // ============================================
    // CONSISTENT DARK MODE (all colors themed)
    // ============================================
    {
      name: "all background colors have dark variants",
      code: `<div className="bg-white dark:bg-slate-900" />`,
    },
    {
      name: "all text colors have dark variants",
      code: `<div className="text-gray-900 dark:text-gray-100" />`,
    },
    {
      name: "all border colors have dark variants",
      code: `<div className="border-gray-200 dark:border-gray-700" />`,
    },
    {
      name: "multiple color types all with dark variants",
      code: `<div className="bg-white dark:bg-slate-900 text-gray-900 dark:text-white border-gray-200 dark:border-gray-800" />`,
    },
    {
      name: "gradient colors all with dark variants",
      code: `<div className="from-blue-500 dark:from-blue-400 via-purple-500 dark:via-purple-400 to-pink-500 dark:to-pink-400" />`,
    },
    {
      name: "ring colors with dark variants",
      code: `<div className="ring-blue-500 dark:ring-blue-400 ring-offset-white dark:ring-offset-slate-900" />`,
    },
    {
      name: "ring and ring-offset are independent - only ring themed is valid",
      code: `<div className="ring-blue-500 dark:ring-blue-400" />`,
    },
    {
      name: "ring and ring-offset are independent - only ring-offset themed is valid",
      code: `<div className="ring-offset-white dark:ring-offset-black" />`,
    },

    // ============================================
    // NO COLOR CLASSES (nothing to check)
    // ============================================
    {
      name: "no color classes - layout only",
      code: `<div className="flex items-center justify-between p-4 m-2" />`,
    },
    {
      name: "no color classes - sizing only",
      code: `<div className="w-full h-screen max-w-lg min-h-0" />`,
    },
    {
      name: "no color classes - typography without color",
      code: `<div className="text-lg font-bold tracking-tight leading-none" />`,
    },
    {
      name: "empty className",
      code: `<div className="" />`,
    },
    {
      name: "whitespace only className",
      code: `<div className="   " />`,
    },

    // ============================================
    // EXEMPT VALUES (don't need dark variants)
    // ============================================
    {
      name: "transparent background is exempt",
      code: `<div className="bg-transparent" />`,
    },
    {
      name: "inherit text color is exempt",
      code: `<div className="text-inherit" />`,
    },
    {
      name: "current border color is exempt",
      code: `<div className="border-current" />`,
    },
    {
      name: "multiple exempt values",
      code: `<div className="bg-transparent text-inherit border-current" />`,
    },
    {
      name: "exempt mixed with properly themed colors",
      code: `<div className="bg-transparent text-gray-900 dark:text-white" />`,
    },
    {
      name: "shadow-none is exempt",
      code: `<div className="shadow-none" />`,
    },

    // ============================================
    // ONLY DARK VARIANTS (edge case - valid)
    // ============================================
    {
      name: "only dark variant colors",
      code: `<div className="dark:bg-slate-900 dark:text-white" />`,
    },

    // ============================================
    // COMPLEX VARIANT CHAINS
    // ============================================
    {
      name: "hover:dark: variant chain",
      code: `<div className="bg-white hover:bg-gray-100 dark:bg-slate-900 dark:hover:bg-slate-800" />`,
    },
    {
      name: "responsive dark variants",
      code: `<div className="bg-white md:bg-gray-50 dark:bg-slate-900 md:dark:bg-slate-800" />`,
    },
    {
      name: "focus and dark variants",
      code: `<div className="text-gray-900 focus:text-blue-500 dark:text-white dark:focus:text-blue-400" />`,
    },
    {
      name: "complex variant chain with dark",
      code: `<div className="bg-white sm:hover:bg-gray-100 dark:bg-black sm:dark:hover:bg-gray-900" />`,
    },

    // ============================================
    // cn() / clsx() / classnames() CALLS - VALID
    // ============================================
    {
      name: "cn() with consistent dark mode",
      code: `cn("bg-white dark:bg-slate-900 text-gray-900 dark:text-white")`,
    },
    {
      name: "clsx() with consistent dark mode",
      code: `clsx("border-gray-200 dark:border-gray-700")`,
    },
    {
      name: "classnames() with consistent dark mode",
      code: `classnames("bg-blue-500 dark:bg-blue-400")`,
    },
    {
      name: "cva() with consistent dark mode",
      code: `cva("bg-white dark:bg-black text-gray-900 dark:text-gray-100")`,
    },
    {
      name: "twMerge() with consistent dark mode",
      code: `twMerge("bg-red-500 dark:bg-red-400")`,
    },
    {
      name: "cn() with no color classes",
      code: `cn("flex items-center gap-4")`,
    },
    {
      name: "cn() with array of consistent classes",
      code: `cn(["bg-white dark:bg-black", "text-gray-900 dark:text-white"])`,
    },

    // ============================================
    // TEMPLATE LITERALS - VALID
    // ============================================
    {
      name: "template literal with consistent dark mode",
      code: "<div className={`bg-white dark:bg-slate-900 text-gray-900 dark:text-white`} />",
    },
    {
      name: "cn() with template literal - consistent",
      code: "cn(`bg-blue-500 dark:bg-blue-400 text-white dark:text-gray-100`)",
    },

    // ============================================
    // JSX EXPRESSION CONTAINERS - VALID
    // ============================================
    {
      name: "JSX expression with string literal - consistent",
      code: `<div className={"bg-white dark:bg-black"} />`,
    },

    // ============================================
    // DIFFERENT BORDER VARIANTS (grouped correctly)
    // ============================================
    {
      name: "different border sides all themed",
      code: `<div className="border-t-gray-200 dark:border-t-gray-700 border-b-gray-300 dark:border-b-gray-600" />`,
    },

    // ============================================
    // MISC VALID CASES
    // ============================================
    {
      name: "class attribute (not className)",
      code: `<div class="bg-white dark:bg-black" />`,
    },
    {
      name: "placeholder color with dark variant",
      code: `<input className="placeholder-gray-400 dark:placeholder-gray-500" />`,
    },
    {
      name: "divide color with dark variant",
      code: `<div className="divide-gray-200 dark:divide-gray-700" />`,
    },
    {
      name: "accent color with dark variant",
      code: `<input className="accent-blue-500 dark:accent-blue-400" />`,
    },
    {
      name: "caret color with dark variant",
      code: `<input className="caret-blue-500 dark:caret-blue-400" />`,
    },
    {
      name: "outline color with dark variant",
      code: `<button className="outline-blue-500 dark:outline-blue-400" />`,
    },
    {
      name: "fill and stroke with dark variants",
      code: `<svg className="fill-blue-500 dark:fill-blue-400 stroke-gray-900 dark:stroke-white" />`,
    },
    {
      name: "decoration color with dark variant",
      code: `<span className="decoration-red-500 dark:decoration-red-400" />`,
    },

    // ============================================
    // warnOnMissingDarkMode: false (file-level warning disabled)
    // ============================================
    {
      name: "no dark mode but warning disabled",
      code: `<div className="bg-white text-gray-900" />`,
      options: [{ warnOnMissingDarkMode: false }],
    },
    {
      name: "multiple elements no dark mode but warning disabled",
      code: `
        function Component() {
          return (
            <>
              <div className="bg-white" />
              <span className="text-gray-900" />
            </>
          );
        }
      `,
      options: [{ warnOnMissingDarkMode: false }],
    },
  ],

  invalid: [
    // ============================================
    // INCONSISTENT DARK MODE - BACKGROUND
    // ============================================
    {
      name: "bg has dark variant but text does not",
      code: `<div className="bg-white dark:bg-slate-900 text-gray-900" />`,
      errors: [
        {
          messageId: "inconsistentDarkMode",
          data: { unthemed: "text-gray-900" },
        },
      ],
    },
    {
      name: "text has dark variant but bg does not",
      code: `<div className="bg-white text-gray-900 dark:text-white" />`,
      errors: [
        {
          messageId: "inconsistentDarkMode",
          data: { unthemed: "bg-white" },
        },
      ],
    },

    // ============================================
    // INCONSISTENT DARK MODE - BORDERS
    // ============================================
    {
      name: "border has dark variant but bg does not",
      code: `<div className="bg-gray-100 border-gray-200 dark:border-gray-700" />`,
      errors: [
        {
          messageId: "inconsistentDarkMode",
          data: { unthemed: "bg-gray-100" },
        },
      ],
    },
    {
      name: "border-t has dark but border-b does not (same group)",
      code: `<div className="border-t-gray-200 dark:border-t-gray-700 border-b-gray-300" />`,
      errors: [
        {
          messageId: "inconsistentDarkMode",
          data: { unthemed: "border-b-gray-300" },
        },
      ],
    },

    // ============================================
    // INCONSISTENT DARK MODE - GRADIENTS
    // ============================================
    {
      name: "from has dark but to does not (gradient group)",
      code: `<div className="from-blue-500 dark:from-blue-400 to-purple-500" />`,
      errors: [
        {
          messageId: "inconsistentDarkMode",
          data: { unthemed: "to-purple-500" },
        },
      ],
    },
    {
      name: "gradient missing via dark variant",
      code: `<div className="from-red-500 dark:from-red-400 via-orange-500 to-yellow-500 dark:to-yellow-400" />`,
      errors: [
        {
          messageId: "inconsistentDarkMode",
          data: { unthemed: "via-orange-500" },
        },
      ],
    },

    // ============================================
    // INCONSISTENT DARK MODE - RING
    // ============================================
    {
      name: "ring has dark variant but ring-offset does not (independent properties)",
      code: `<div className="ring-blue-500 dark:ring-blue-400 ring-offset-white" />`,
      errors: [
        {
          messageId: "inconsistentDarkMode",
          data: { unthemed: "ring-offset-white" },
        },
      ],
    },

    // ============================================
    // INCONSISTENT DARK MODE - MULTIPLE UNTHEMED
    // ============================================
    {
      name: "multiple unthemed color classes",
      code: `<div className="bg-white dark:bg-black text-gray-900 border-gray-200" />`,
      errors: [
        {
          messageId: "inconsistentDarkMode",
          data: { unthemed: "text-gray-900, border-gray-200" },
        },
      ],
    },

    // ============================================
    // cn() / clsx() / classnames() - INCONSISTENT
    // ============================================
    {
      name: "cn() with inconsistent dark mode",
      code: `cn("bg-white dark:bg-slate-900 text-gray-900")`,
      errors: [
        {
          messageId: "inconsistentDarkMode",
          data: { unthemed: "text-gray-900" },
        },
      ],
    },
    {
      name: "clsx() with inconsistent dark mode",
      code: `clsx("bg-blue-500 dark:bg-blue-400 border-blue-600")`,
      errors: [
        {
          messageId: "inconsistentDarkMode",
          data: { unthemed: "border-blue-600" },
        },
      ],
    },
    {
      name: "classnames() with inconsistent dark mode",
      code: `classnames("text-red-500 dark:text-red-400 bg-red-50")`,
      errors: [
        {
          messageId: "inconsistentDarkMode",
          data: { unthemed: "bg-red-50" },
        },
      ],
    },
    {
      name: "cva() with inconsistent dark mode",
      code: `cva("bg-white dark:bg-black text-gray-900")`,
      errors: [
        {
          messageId: "inconsistentDarkMode",
          data: { unthemed: "text-gray-900" },
        },
      ],
    },
    {
      name: "twMerge() with inconsistent dark mode",
      code: `twMerge("bg-white dark:bg-black text-black")`,
      errors: [
        {
          messageId: "inconsistentDarkMode",
          data: { unthemed: "text-black" },
        },
      ],
    },

    // ============================================
    // ARRAY ARGUMENTS - INCONSISTENT
    // ============================================
    {
      name: "cn() array with inconsistent class string",
      code: `cn(["bg-white dark:bg-black text-gray-900"])`,
      errors: [
        {
          messageId: "inconsistentDarkMode",
          data: { unthemed: "text-gray-900" },
        },
      ],
    },

    // ============================================
    // TEMPLATE LITERALS - INCONSISTENT
    // ============================================
    {
      name: "template literal with inconsistent dark mode",
      code: "<div className={`bg-white dark:bg-slate-900 text-gray-900`} />",
      errors: [
        {
          messageId: "inconsistentDarkMode",
          data: { unthemed: "text-gray-900" },
        },
      ],
    },
    {
      name: "cn() template literal - inconsistent",
      code: "cn(`bg-blue-500 dark:bg-blue-400 text-white`)",
      errors: [
        {
          messageId: "inconsistentDarkMode",
          data: { unthemed: "text-white" },
        },
      ],
    },

    // ============================================
    // JSX EXPRESSION STRING - INCONSISTENT
    // ============================================
    {
      name: "JSX expression string literal - inconsistent",
      code: `<div className={"bg-white dark:bg-black text-gray-900"} />`,
      errors: [
        {
          messageId: "inconsistentDarkMode",
          data: { unthemed: "text-gray-900" },
        },
      ],
    },

    // ============================================
    // class ATTRIBUTE (not className)
    // ============================================
    {
      name: "class attribute with inconsistent dark mode",
      code: `<div class="bg-white dark:bg-black text-gray-900" />`,
      errors: [
        {
          messageId: "inconsistentDarkMode",
          data: { unthemed: "text-gray-900" },
        },
      ],
    },

    // ============================================
    // COMPLEX VARIANTS - INCONSISTENT
    // ============================================
    {
      name: "hover variant present but no dark for one color type",
      code: `<div className="bg-white hover:bg-gray-100 dark:bg-black dark:hover:bg-gray-900 text-gray-900 hover:text-black" />`,
      errors: [
        {
          messageId: "inconsistentDarkMode",
          data: { unthemed: "text-gray-900, hover:text-black" },
        },
      ],
    },

    // ============================================
    // MISSING DARK MODE (file-level warning)
    // ============================================
    {
      name: "single element with colors but no dark mode",
      code: `<div className="bg-white text-gray-900" />`,
      errors: [
        {
          messageId: "missingDarkMode",
        },
      ],
    },
    {
      name: "multiple elements with colors but no dark mode",
      code: `
        function Component() {
          return (
            <>
              <div className="bg-white" />
              <span className="text-gray-900" />
              <button className="bg-blue-500 text-white" />
            </>
          );
        }
      `,
      errors: [
        {
          messageId: "missingDarkMode",
        },
      ],
    },
    {
      name: "cn() with colors but no dark mode",
      code: `cn("bg-white text-gray-900 border-gray-200")`,
      errors: [
        {
          messageId: "missingDarkMode",
        },
      ],
    },
    {
      name: "only background color no dark mode",
      code: `<div className="bg-slate-100" />`,
      errors: [
        {
          messageId: "missingDarkMode",
        },
      ],
    },
    {
      name: "only text color no dark mode",
      code: `<span className="text-blue-600" />`,
      errors: [
        {
          messageId: "missingDarkMode",
        },
      ],
    },
    {
      name: "only border color no dark mode",
      code: `<div className="border-red-500" />`,
      errors: [
        {
          messageId: "missingDarkMode",
        },
      ],
    },
    {
      name: "gradient without dark mode",
      code: `<div className="from-blue-500 via-purple-500 to-pink-500" />`,
      errors: [
        {
          messageId: "missingDarkMode",
        },
      ],
    },

    // ============================================
    // BOTH ERRORS IN SAME FILE
    // ============================================
    {
      name: "inconsistent in one element, missing in file",
      code: `
        function Component() {
          return (
            <>
              <div className="bg-white dark:bg-black text-gray-900" />
              <span className="text-blue-500" />
            </>
          );
        }
      `,
      errors: [
        {
          messageId: "inconsistentDarkMode",
          data: { unthemed: "text-gray-900" },
        },
      ],
    },

    // ============================================
    // EDGE CASES - SPECIFIC COLOR CLASSES
    // ============================================
    {
      name: "placeholder color inconsistent",
      code: `<input className="placeholder-gray-400 text-gray-900 dark:text-white" />`,
      errors: [
        {
          messageId: "inconsistentDarkMode",
          data: { unthemed: "placeholder-gray-400" },
        },
      ],
    },
    {
      name: "divide color inconsistent",
      code: `<div className="divide-gray-200 bg-white dark:bg-black" />`,
      errors: [
        {
          messageId: "inconsistentDarkMode",
          data: { unthemed: "divide-gray-200" },
        },
      ],
    },
    {
      name: "shadow color inconsistent",
      code: `<div className="shadow-blue-500/50 bg-blue-500 dark:bg-blue-400" />`,
      errors: [
        {
          messageId: "inconsistentDarkMode",
          data: { unthemed: "shadow-blue-500/50" },
        },
      ],
    },
    {
      name: "fill inconsistent with stroke",
      code: `<svg className="fill-blue-500 dark:fill-blue-400 stroke-gray-900" />`,
      errors: [
        {
          messageId: "inconsistentDarkMode",
          data: { unthemed: "stroke-gray-900" },
        },
      ],
    },
    {
      name: "decoration color inconsistent",
      code: `<span className="decoration-red-500 text-red-600 dark:text-red-400" />`,
      errors: [
        {
          messageId: "inconsistentDarkMode",
          data: { unthemed: "decoration-red-500" },
        },
      ],
    },
    {
      name: "accent color inconsistent",
      code: `<input className="accent-blue-500 bg-white dark:bg-gray-900" />`,
      errors: [
        {
          messageId: "inconsistentDarkMode",
          data: { unthemed: "accent-blue-500" },
        },
      ],
    },
    {
      name: "caret color inconsistent",
      code: `<input className="caret-blue-500 bg-white dark:bg-gray-900" />`,
      errors: [
        {
          messageId: "inconsistentDarkMode",
          data: { unthemed: "caret-blue-500" },
        },
      ],
    },
    {
      name: "outline color inconsistent",
      code: `<button className="outline-blue-500 bg-blue-500 dark:bg-blue-400" />`,
      errors: [
        {
          messageId: "inconsistentDarkMode",
          data: { unthemed: "outline-blue-500" },
        },
      ],
    },
  ],
});
