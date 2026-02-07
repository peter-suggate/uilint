/**
 * uilint-semantic/node - Node.js exports
 *
 * Includes duplicate detection which requires filesystem access.
 * Import this for server-side analysis.
 */

// Re-export everything from browser-safe entry
export * from "./index.js";

// Node.js only exports will be added when we move detection code
// export {
//   DuplicateFinder,
//   findDuplicates,
//   findSimilar,
// } from "./detection/index.js";

// export {
//   Chunker,
//   generateChunks,
// } from "./embeddings/chunker.js";

// export {
//   buildIndex,
//   queryIndex,
// } from "./index/index.js";
