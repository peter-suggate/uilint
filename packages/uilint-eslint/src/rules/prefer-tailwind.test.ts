/**
 * Tests for: prefer-tailwind
 *
 * Encourages using Tailwind className over inline style attributes.
 */

import { RuleTester } from "@typescript-eslint/rule-tester";
import { describe, it, afterAll } from "vitest";
import rule from "./prefer-tailwind.js";

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

ruleTester.run("prefer-tailwind", rule, {
  valid: [
    // ============================================
    // TAILWIND ONLY (no style attribute)
    // ============================================
    {
      name: "all elements use className only",
      code: `
        function Component() {
          return (
            <>
              <div className="p-4" />
              <span className="text-red-500" />
              <p className="mt-2" />
            </>
          );
        }
      `,
    },
    {
      name: "using class attribute (HTML)",
      code: `
        function Component() {
          return (
            <>
              <div class="p-4" />
              <span class="text-red-500" />
              <p class="mt-2" />
            </>
          );
        }
      `,
    },

    // ============================================
    // BOTH STYLE AND CLASSNAME (acceptable)
    // ============================================
    {
      name: "elements with both style and className are fine",
      code: `
        function Component() {
          const dynamicColor = 'red';
          return (
            <>
              <div className="p-4" style={{ backgroundColor: dynamicColor }} />
              <span className="mt-2" style={{ color: dynamicColor }} />
              <p className="text-lg" style={{ fontSize: dynamicSize }} />
            </>
          );
        }
      `,
    },
    {
      name: "mix of className-only and className+style",
      code: `
        function Component() {
          return (
            <>
              <div className="p-4" />
              <span className="mt-2" style={{ color: dynamicColor }} />
              <p className="text-lg" />
            </>
          );
        }
      `,
    },

    // ============================================
    // BELOW THRESHOLD (not enough elements)
    // ============================================
    {
      name: "too few styled elements to analyze (default minElements=3)",
      code: `
        function Component() {
          return (
            <>
              <div style={{ color: 'red' }} />
              <span style={{ margin: '10px' }} />
            </>
          );
        }
      `,
    },
    {
      name: "single style-only element in file",
      code: `<div style={{ color: 'red' }} />`,
    },

    // ============================================
    // LOW RATIO (below threshold)
    // ============================================
    {
      name: "style ratio below threshold (1 style-only out of 4 = 25%)",
      code: `
        function Component() {
          return (
            <>
              <div className="p-4" />
              <span className="text-red-500" />
              <p className="mt-2" />
              <section style={{ margin: '10px' }} />
            </>
          );
        }
      `,
    },
    {
      name: "exactly at threshold (30%) should not warn",
      code: `
        function Component() {
          return (
            <>
              <div className="p-4" />
              <span className="text-red-500" />
              <p className="mt-2" />
              <section className="bg-white" />
              <article className="flex" />
              <main className="grid" />
              <header className="sticky" />
              <footer style={{ padding: '10px' }} />
              <aside style={{ margin: '10px' }} />
              <nav style={{ color: 'red' }} />
            </>
          );
        }
      `,
      // 3 style-only out of 10 = 30%, exactly at threshold (uses >)
    },

    // ============================================
    // NO STYLED ELEMENTS
    // ============================================
    {
      name: "no style or className attributes",
      code: `
        function Component() {
          return (
            <>
              <div id="main" />
              <span data-test="value" />
              <p>Plain text</p>
            </>
          );
        }
      `,
    },

    // ============================================
    // CUSTOM OPTIONS - styleRatioThreshold
    // ============================================
    {
      name: "custom threshold allows higher ratio",
      code: `
        function Component() {
          return (
            <>
              <div style={{ color: 'red' }} />
              <span style={{ margin: '10px' }} />
              <p className="text-lg" />
            </>
          );
        }
      `,
      options: [{ styleRatioThreshold: 0.7 }], // 66% < 70%
    },

    // ============================================
    // CUSTOM OPTIONS - minElementsForAnalysis
    // ============================================
    {
      name: "custom minElements prevents analysis",
      code: `
        function Component() {
          return (
            <>
              <div style={{ color: 'red' }} />
              <span style={{ margin: '10px' }} />
              <p style={{ padding: '5px' }} />
              <section style={{ border: '1px solid' }} />
            </>
          );
        }
      `,
      options: [{ minElementsForAnalysis: 5 }], // Only 4 elements
    },

    // ============================================
    // CUSTOM OPTIONS - allowedStyleProperties
    // ============================================
    {
      name: "allowed style properties are ignored",
      code: `
        function Component() {
          return (
            <>
              <div style={{ transform: 'rotate(45deg)' }} />
              <span style={{ animation: 'spin 1s' }} />
              <p style={{ transform: 'scale(1.5)' }} />
            </>
          );
        }
      `,
      options: [{ allowedStyleProperties: ["transform", "animation"] }],
    },
    {
      name: "mixed allowed and disallowed properties - all allowed",
      code: `
        function Component() {
          return (
            <>
              <div className="p-4" />
              <span style={{ transform: 'rotate(45deg)', animation: 'spin' }} />
              <p className="mt-2" />
            </>
          );
        }
      `,
      options: [{ allowedStyleProperties: ["transform", "animation"] }],
    },

    // ============================================
    // CUSTOM OPTIONS - ignoreComponents
    // ============================================
    {
      name: "ignored components are skipped",
      code: `
        function Component() {
          return (
            <>
              <motion.div style={{ opacity: 0 }} />
              <motion.div style={{ x: 100 }} />
              <motion.div style={{ scale: 1.5 }} />
            </>
          );
        }
      `,
      options: [{ ignoreComponents: ["motion.div"] }],
    },
    {
      name: "animated library components ignored",
      code: `
        function Component() {
          return (
            <>
              <animated.View style={{ opacity: spring }} />
              <animated.div style={{ transform: animation }} />
              <animated.span style={{ color: colorSpring }} />
            </>
          );
        }
      `,
      options: [{ ignoreComponents: ["animated.View", "animated.div", "animated.span"] }],
    },

    // ============================================
    // EDGE CASES
    // ============================================
    {
      name: "className from cn() function",
      code: `
        function Component() {
          return (
            <>
              <div className={cn("p-4")} />
              <span className={cn("text-red")} />
              <p className={cn("mt-2")} />
            </>
          );
        }
      `,
    },
    {
      name: "className from template literal",
      code: `
        function Component() {
          return (
            <>
              <div className={\`p-4 \${isActive ? 'active' : ''}\`} />
              <span className={\`text-red-500\`} />
              <p className={\`mt-2\`} />
            </>
          );
        }
      `,
    },
  ],

  invalid: [
    // ============================================
    // HIGH RATIO OF STYLE-ONLY ELEMENTS
    // ============================================
    {
      name: "all elements use style only (100%)",
      code: `
        function Component() {
          return (
            <>
              <div style={{ color: 'red' }} />
              <span style={{ margin: '10px' }} />
              <p style={{ padding: '5px' }} />
            </>
          );
        }
      `,
      errors: [
        { messageId: "preferTailwind" },
        { messageId: "preferTailwind" },
        { messageId: "preferTailwind" },
      ],
    },
    {
      name: "high ratio (75% style-only)",
      code: `
        function Component() {
          return (
            <>
              <div style={{ color: 'red' }} />
              <span style={{ margin: '10px' }} />
              <p style={{ padding: '5px' }} />
              <section className="p-4" />
            </>
          );
        }
      `,
      errors: [
        { messageId: "preferTailwind" },
        { messageId: "preferTailwind" },
        { messageId: "preferTailwind" },
      ],
    },
    {
      name: "just over threshold (40% when threshold is 30%)",
      code: `
        function Component() {
          return (
            <>
              <div className="p-4" />
              <span className="text-red" />
              <p className="mt-2" />
              <section style={{ margin: '10px' }} />
              <article style={{ padding: '5px' }} />
            </>
          );
        }
      `,
      // 2 style-only out of 5 = 40% > 30%
      errors: [
        { messageId: "preferTailwind" },
        { messageId: "preferTailwind" },
      ],
    },

    // ============================================
    // STYLE ATTRIBUTE VARIANTS
    // ============================================
    {
      name: "detects style object expressions",
      code: `
        function Component() {
          const styles = { color: 'red' };
          return (
            <>
              <div style={{ color: 'red' }} />
              <span style={styles} />
              <p style={{ ...styles, margin: '10px' }} />
            </>
          );
        }
      `,
      errors: [
        { messageId: "preferTailwind" },
        { messageId: "preferTailwind" },
        { messageId: "preferTailwind" },
      ],
    },

    // ============================================
    // MIXED WITH ACCEPTABLE ELEMENTS
    // ============================================
    {
      name: "reports only style-only elements, not style+className",
      code: `
        function Component() {
          return (
            <>
              <div style={{ color: 'red' }} />
              <span style={{ margin: '10px' }} />
              <p className="text-lg" style={{ fontSize: '14px' }} />
              <section style={{ padding: '5px' }} />
            </>
          );
        }
      `,
      // 3 style-only, 1 style+className
      // Ratio: 3/4 = 75%
      errors: [
        { messageId: "preferTailwind" },
        { messageId: "preferTailwind" },
        { messageId: "preferTailwind" },
      ],
    },

    // ============================================
    // CUSTOM OPTIONS - STRICTER THRESHOLD
    // ============================================
    {
      name: "custom lower threshold catches more",
      code: `
        function Component() {
          return (
            <>
              <div className="p-4" />
              <span className="text-red" />
              <p className="mt-2" />
              <section className="bg-white" />
              <article style={{ margin: '10px' }} />
            </>
          );
        }
      `,
      options: [{ styleRatioThreshold: 0.1 }], // 20% > 10%
      errors: [{ messageId: "preferTailwind" }],
    },

    // ============================================
    // ALLOWED PROPERTIES WITH DISALLOWED
    // ============================================
    {
      name: "mixed allowed and disallowed properties still warns",
      code: `
        function Component() {
          return (
            <>
              <div style={{ transform: 'rotate(45deg)', color: 'red' }} />
              <span style={{ transform: 'scale(1.5)', margin: '10px' }} />
              <p style={{ animation: 'spin', padding: '5px' }} />
            </>
          );
        }
      `,
      options: [{ allowedStyleProperties: ["transform", "animation"] }],
      // Each element has at least one non-allowed property
      errors: [
        { messageId: "preferTailwind" },
        { messageId: "preferTailwind" },
        { messageId: "preferTailwind" },
      ],
    },

    // ============================================
    // IGNORED COMPONENTS DON'T AFFECT RATIO
    // ============================================
    {
      name: "ignored components don't affect ratio calculation",
      code: `
        function Component() {
          return (
            <>
              <motion.div style={{ x: 100 }} />
              <div style={{ color: 'red' }} />
              <span style={{ margin: '10px' }} />
              <p style={{ padding: '5px' }} />
            </>
          );
        }
      `,
      options: [{ ignoreComponents: ["motion.div"] }],
      // motion.div is ignored, so 3/3 = 100% style-only
      errors: [
        { messageId: "preferTailwind" },
        { messageId: "preferTailwind" },
        { messageId: "preferTailwind" },
      ],
    },

    // ============================================
    // PREFER SEMANTIC COLORS
    // ============================================
    {
      name: "hard-coded color classes trigger warning (bg-red-500)",
      code: `
        function Component() {
          return (
            <>
              <div className="bg-red-500 p-4" />
              <span className="text-blue-600" />
              <p className="border-green-400" />
            </>
          );
        }
      `,
      options: [{ preferSemanticColors: true }],
      errors: [
        { messageId: "preferSemanticColors" },
        { messageId: "preferSemanticColors" },
        { messageId: "preferSemanticColors" },
      ],
    },
    {
      name: "hard-coded color with opacity modifier",
      code: `
        function Component() {
          return <div className="bg-red-500/50 text-blue-600/75" />;
        }
      `,
      options: [{ preferSemanticColors: true }],
      errors: [{ messageId: "preferSemanticColors" }],
    },
    {
      name: "hard-coded colors in hover/focus states",
      code: `
        function Component() {
          return <button className="hover:bg-red-500 focus:text-blue-600" />;
        }
      `,
      options: [{ preferSemanticColors: true }],
      errors: [{ messageId: "preferSemanticColors" }],
    },
    {
      name: "hard-coded colors in dark mode variants",
      code: `
        function Component() {
          return <div className="dark:bg-slate-800 dark:text-gray-100" />;
        }
      `,
      options: [{ preferSemanticColors: true }],
      errors: [{ messageId: "preferSemanticColors" }],
    },
    {
      name: "ring and outline colors",
      code: `
        function Component() {
          return <input className="ring-blue-500 outline-red-400" />;
        }
      `,
      options: [{ preferSemanticColors: true }],
      errors: [{ messageId: "preferSemanticColors" }],
    },
    {
      name: "gradient colors",
      code: `
        function Component() {
          return <div className="from-blue-500 via-purple-500 to-pink-500" />;
        }
      `,
      options: [{ preferSemanticColors: true }],
      errors: [{ messageId: "preferSemanticColors" }],
    },
    {
      name: "decoration and accent colors",
      code: `
        function Component() {
          return <div className="decoration-red-500 accent-blue-600" />;
        }
      `,
      options: [{ preferSemanticColors: true }],
      errors: [{ messageId: "preferSemanticColors" }],
    },
  ],
});

// Separate test suite for preferSemanticColors valid cases
ruleTester.run("prefer-tailwind (semantic colors - valid)", rule, {
  valid: [
    // ============================================
    // SEMANTIC COLORS (preferred)
    // ============================================
    {
      name: "semantic color classes are fine",
      code: `
        function Component() {
          return (
            <>
              <div className="bg-background text-foreground" />
              <span className="bg-destructive text-destructive-foreground" />
              <p className="bg-primary text-primary-foreground" />
            </>
          );
        }
      `,
      options: [{ preferSemanticColors: true }],
    },
    {
      name: "shadcn semantic colors",
      code: `
        function Component() {
          return (
            <>
              <div className="bg-card text-card-foreground" />
              <div className="bg-popover text-popover-foreground" />
              <div className="bg-muted text-muted-foreground" />
              <div className="bg-accent text-accent-foreground" />
              <div className="border-border" />
              <div className="ring-ring" />
            </>
          );
        }
      `,
      options: [{ preferSemanticColors: true }],
    },
    {
      name: "custom semantic colors",
      code: `
        function Component() {
          return (
            <>
              <div className="bg-warning text-warning-foreground" />
              <div className="bg-success text-success-foreground" />
              <div className="bg-info text-info-foreground" />
              <div className="bg-danger text-danger-foreground" />
            </>
          );
        }
      `,
      options: [{ preferSemanticColors: true }],
    },

    // ============================================
    // NEUTRAL/STRUCTURAL COLORS (allowed by default)
    // ============================================
    {
      name: "white/black/transparent are allowed",
      code: `
        function Component() {
          return (
            <>
              <div className="bg-white text-black" />
              <div className="bg-transparent" />
              <div className="border-white/50" />
            </>
          );
        }
      `,
      options: [{ preferSemanticColors: true }],
    },
    {
      name: "inherit and current are allowed",
      code: `
        function Component() {
          return (
            <>
              <div className="text-inherit bg-inherit" />
              <div className="border-current" />
            </>
          );
        }
      `,
      options: [{ preferSemanticColors: true }],
    },

    // ============================================
    // NON-COLOR CLASSES
    // ============================================
    {
      name: "non-color utility classes are fine",
      code: `
        function Component() {
          return (
            <>
              <div className="p-4 m-2 flex items-center" />
              <span className="text-lg font-bold" />
              <p className="rounded-lg shadow-md" />
            </>
          );
        }
      `,
      options: [{ preferSemanticColors: true }],
    },

    // ============================================
    // OPTION DISABLED (default)
    // ============================================
    {
      name: "hard-coded colors allowed when option disabled",
      code: `
        function Component() {
          return (
            <>
              <div className="bg-red-500" />
              <span className="text-blue-600" />
            </>
          );
        }
      `,
      // preferSemanticColors defaults to false
    },
    {
      name: "explicitly disabled option allows hard-coded colors",
      code: `
        function Component() {
          return <div className="bg-red-500 text-blue-600" />;
        }
      `,
      options: [{ preferSemanticColors: false }],
    },

    // ============================================
    // ALLOWED HARD-CODED COLORS
    // ============================================
    {
      name: "allowedHardCodedColors option whitelists specific colors",
      code: `
        function Component() {
          return (
            <>
              <div className="bg-red-500" />
              <span className="text-blue-600" />
            </>
          );
        }
      `,
      options: [{ preferSemanticColors: true, allowedHardCodedColors: ["red", "blue"] }],
    },
    {
      name: "allowed colors work with all shades",
      code: `
        function Component() {
          return (
            <>
              <div className="bg-gray-50 text-gray-900" />
              <div className="border-gray-200 ring-gray-300" />
            </>
          );
        }
      `,
      options: [{ preferSemanticColors: true, allowedHardCodedColors: ["gray"] }],
    },
  ],
  invalid: [],
});
