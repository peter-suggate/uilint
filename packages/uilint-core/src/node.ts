/**
 * UILint Core - Node.js-specific exports
 *
 * This entry point includes Node.js-only features like JSDOM parsing
 * and filesystem operations.
 */

// Re-export everything from main entry
export * from "./index.js";

// Node.js-specific: Ollama bootstrap helpers (LLM readiness)
export {
  isOllamaInstalled,
  ensureOllamaInstalledOrExplain,
  ensureOllamaRunning,
  ensureOllamaModelPulled,
  ensureOllamaReady,
} from "./ollama/bootstrap.js";

// Node.js-specific: HTML parser with JSDOM
export {
  parseHTML,
  parseCLIInput,
  isJSON,
  readStdin,
  hasStdin,
} from "./scanner/html-parser.js";

// Node.js-specific: Filesystem operations
export {
  STYLEGUIDE_PATHS,
  findStyleGuidePath,
  findUILintStyleGuideUpwards,
  readStyleGuide,
  readStyleGuideFromProject,
  writeStyleGuide,
  getDefaultStyleGuidePath,
  styleGuideExists,
} from "./styleguide/reader.js";

// Node.js-specific: workspace root detection (monorepo support)
export { findWorkspaceRoot } from "./utils/workspace-root.js";

// Node.js-specific: Tailwind config reader
export {
  findTailwindConfigPath,
  readTailwindThemeTokens,
} from "./tailwind/config-reader.js";
