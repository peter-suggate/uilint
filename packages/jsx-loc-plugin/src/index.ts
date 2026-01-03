/**
 * Next.js plugin that adds data-loc attributes to JSX elements.
 * Compatible with Next.js 16+ (supports both webpack and Turbopack)
 */

import path from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";

// For ESM: compute __dirname from import.meta.url
// For CJS: tsup will see this but __dirname is already available globally
let computedDirname: string;
try {
  // ESM path
  computedDirname = path.dirname(fileURLToPath(import.meta.url));
} catch {
  // CJS fallback - __dirname is available globally in CJS
  computedDirname = typeof __dirname !== "undefined" ? __dirname : "";
}

export interface JsxLocPluginOptions {
  /** RegExp patterns to include (default: all .jsx/.tsx files) */
  include?: RegExp | RegExp[];
  /** RegExp patterns to exclude (default: /node_modules/) */
  exclude?: RegExp | RegExp[];
}

interface LoaderConfig {
  loader: string;
  options: JsxLocPluginOptions;
}

interface WebpackRule {
  test: RegExp;
  enforce: "pre" | "post";
  use: LoaderConfig[];
  exclude?: RegExp | RegExp[];
  include?: RegExp | RegExp[];
}

/**
 * Next.js plugin that adds data-loc attributes to JSX elements
 * to help with component tracking and debugging.
 *
 * Supports both webpack and Turbopack configurations.
 */
export function withJsxLoc(
  nextConfig: NextConfig = {},
  pluginOptions: JsxLocPluginOptions = {}
): NextConfig {
  const loaderPath = path.join(computedDirname, "loader.cjs");
  console.log(`[jsx-loc-plugin] Plugin loaded, loader path: ${loaderPath}`);

  const loaderObj: LoaderConfig = {
    loader: loaderPath,
    options: { ...pluginOptions },
  };

  const jsxRule: WebpackRule = {
    test: /\.(jsx|tsx)$/,
    enforce: "pre",
    use: [loaderObj],
    exclude: pluginOptions.exclude || /node_modules/,
  };

  if (pluginOptions.include) {
    jsxRule.include = pluginOptions.include;
  }

  // Turbopack rules format for Next.js 16+
  // The 'as' property specifies what the loader output is treated as
  // We need to exclude 'foreign' (node_modules) to avoid processing dependencies
  // Use path condition with RegExp to ensure we only match files with extensions
  const tsxLoaderConfig = {
    condition: {
      all: [
        { not: "foreign" },
        // Only match paths that end with .tsx (not directories)
        { path: /\/[^/]+\.tsx$/ },
      ],
    },
    loaders: [
      {
        loader: loaderPath,
        options: { ...pluginOptions },
      },
    ],
    // as: "*.tsx",
  };

  const jsxLoaderConfig = {
    condition: {
      all: [
        { not: "foreign" },
        // Only match paths that end with .jsx (not directories)
        { path: /\/[^/]+\.jsx$/ },
      ],
    },
    loaders: [
      {
        loader: loaderPath,
        options: { ...pluginOptions },
      },
    ],
    // as: "*.jsx",
  };

  // Match all .tsx and .jsx files (excluding node_modules via condition)
  const turbopackRules: Record<string, object> = {
    "*.tsx": tsxLoaderConfig,
    "*.jsx": jsxLoaderConfig,
  };

  // Get existing turbopack config if any
  const existingTurbopack = (nextConfig as any).turbopack || {};
  const existingRules = existingTurbopack.rules || {};

  const enhancedConfig: NextConfig = {
    ...nextConfig,

    // Configure webpack
    webpack(config, options) {
      if (!config.module) {
        config.module = { rules: [] };
      }
      if (!config.module.rules) {
        config.module.rules = [];
      }
      config.module.rules.unshift(jsxRule);

      if (typeof nextConfig.webpack === "function") {
        return nextConfig.webpack(config, options);
      }
      return config;
    },

    // Configure Turbopack (Next.js 16+ top-level turbopack key)
    turbopack: {
      ...existingTurbopack,
      rules: {
        ...existingRules,
        ...turbopackRules,
      },
    },
  };

  return enhancedConfig;
}

export default withJsxLoc;
