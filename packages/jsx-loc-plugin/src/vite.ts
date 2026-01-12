/**
 * Vite plugin that adds `data-loc` attributes to JSX elements.
 *
 * This powers UILint's in-browser inspection overlay for Vite projects.
 */

import type { Plugin } from "vite";
import { shouldProcessFile, transformJsxCode } from "./transform.js";
import type { JsxLocPluginOptions } from "./index.js";

function stripQuery(id: string): string {
  const q = id.indexOf("?");
  return q === -1 ? id : id.slice(0, q);
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function matchesAny(re: RegExp | RegExp[] | undefined, value: string): boolean {
  const list = asArray(re);
  if (list.length === 0) return true;
  return list.some((r) => r.test(value));
}

/**
 * Create a Vite plugin that injects `data-loc` on JSX elements.
 *
 * @example
 * import { defineConfig } from "vite";
 * import react from "@vitejs/plugin-react";
 * import { jsxLoc } from "jsx-loc-plugin/vite";
 *
 * export default defineConfig({
 *   plugins: [react(), jsxLoc()],
 * });
 */
export function jsxLoc(options: JsxLocPluginOptions = {}): Plugin {
  const exclude = options.exclude ?? /node_modules/;

  return {
    name: "jsx-loc-plugin",
    enforce: "pre",
    transform(code: string, id: string) {
      const filePath = stripQuery(id);
      if (!shouldProcessFile(filePath)) return null;
      if (!matchesAny(options.include, filePath)) return null;
      if (asArray(exclude).some((r) => r.test(filePath))) return null;

      const result = transformJsxCode(code, filePath);
      if (!result) return null;

      return {
        code: result.code,
        map: result.map as any,
      };
    },
  };
}

export default jsxLoc;
