/**
 * Node.js-specific exports for uilint-react
 *
 * This entry point includes features that require Node.js APIs (fs, path, etc.)
 * Use this in Node.js/test environments, not in browser bundles.
 */

// JSDOM adapter for testing environments
export { JSDOMAdapter, runUILintInTest } from "./scanner/jsdom-adapter.js";

// Re-export isJSDOM for convenience
export { isJSDOM } from "./scanner/environment.js";

