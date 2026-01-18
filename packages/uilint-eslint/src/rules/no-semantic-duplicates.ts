/**
 * Rule: no-semantic-duplicates
 *
 * Warns when code is semantically similar to existing indexed code.
 * This rule queries a pre-built semantic index (from uilint duplicates index)
 * rather than calling the LLM during linting - making it fast.
 *
 * Prerequisites:
 * - Run `uilint duplicates index` to build the semantic index first
 * - The index is stored at .uilint/.duplicates-index/
 */

import { createRule, defineRuleMeta } from "../utils/create-rule.js";
import type { TSESTree } from "@typescript-eslint/utils";
import { existsSync, readFileSync, appendFileSync, writeFileSync } from "fs";
import { dirname, join, relative } from "path";

// Debug logging - writes to .uilint/no-semantic-duplicates.log in the project root
let logFile: string | null = null;
let logInitialized = false;

function initLog(projectRoot: string): void {
  if (logFile) return;
  const uilintDir = join(projectRoot, ".uilint");
  if (existsSync(uilintDir)) {
    logFile = join(uilintDir, "no-semantic-duplicates.log");
  }
}

function log(message: string): void {
  if (!logFile) return;
  try {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${message}\n`;
    if (!logInitialized) {
      writeFileSync(logFile, line);
      logInitialized = true;
    } else {
      appendFileSync(logFile, line);
    }
  } catch {
    // Ignore logging errors
  }
}

type MessageIds = "semanticDuplicate" | "noIndex";
type Options = [
  {
    /** Similarity threshold (0-1). Default: 0.85 */
    threshold?: number;
    /** Path to the index directory */
    indexPath?: string;
    /** Minimum number of lines for a chunk to be reported (default: 3) */
    minLines?: number;
  }
];

/**
 * Rule metadata
 */
export const meta = defineRuleMeta({
  id: "no-semantic-duplicates",
  name: "No Semantic Duplicates",
  description: "Warn when code is semantically similar to existing code",
  defaultSeverity: "warn",
  category: "semantic",
  defaultOptions: [{ threshold: 0.85, indexPath: ".uilint/.duplicates-index", minLines: 3 }],
  optionSchema: {
    fields: [
      {
        key: "threshold",
        label: "Similarity threshold",
        type: "number",
        defaultValue: 0.85,
        description:
          "Minimum similarity score (0-1) to report as duplicate. Higher = stricter.",
      },
      {
        key: "indexPath",
        label: "Index path",
        type: "text",
        defaultValue: ".uilint/.duplicates-index",
        description: "Path to the semantic duplicates index directory",
      },
      {
        key: "minLines",
        label: "Minimum lines",
        type: "number",
        defaultValue: 3,
        description:
          "Minimum number of lines for a chunk to be reported as a potential duplicate.",
      },
    ],
  },
  docs: `
## What it does

Warns when code (components, hooks, functions) is semantically similar to other
code in the codebase. Unlike syntactic duplicate detection, this finds code that
implements similar functionality even if written differently.

## Prerequisites

Before using this rule, you must build the semantic index:

\`\`\`bash
uilint duplicates index
\`\`\`

This creates an embedding-based index at \`.uilint/.duplicates-index/\`.

## Why it's useful

- **Reduce Duplication**: Find components/hooks that could be consolidated
- **Discover Patterns**: Identify similar code that could be abstracted
- **Code Quality**: Encourage reuse over reimplementation
- **Fast**: Queries pre-built index, no LLM calls during linting

## How it works

1. The rule checks if the current file is in the semantic index
2. For each indexed code chunk, it looks up similar chunks
3. If similar chunks exist above the threshold, it reports a warning

## Examples

### Semantic duplicates detected:

\`\`\`tsx
// UserCard.tsx - Original component
export function UserCard({ user }) {
  return (
    <div className="card">
      <img src={user.avatar} />
      <h3>{user.name}</h3>
    </div>
  );
}

// ProfileCard.tsx - Semantically similar (warning!)
export function ProfileCard({ profile }) {
  return (
    <article className="profile">
      <img src={profile.avatarUrl} />
      <h2>{profile.displayName}</h2>
    </article>
  );
}
\`\`\`

## Configuration

\`\`\`js
// eslint.config.js
"uilint/no-semantic-duplicates": ["warn", {
  threshold: 0.85,      // Similarity threshold (0-1)
  indexPath: ".uilint/.duplicates-index",
  minLines: 3           // Minimum lines to report (default: 3)
}]
\`\`\`

## Notes

- Run \`uilint duplicates index\` after significant code changes
- Use \`uilint duplicates find\` to explore all duplicate groups
- The rule only reports if the file is in the index
`,
});

// Cache for loaded index data across files in a single ESLint run
let indexCache: {
  projectRoot: string;
  vectorStore: Map<string, number[]>;
  metadataStore: Map<
    string,
    {
      filePath: string;
      startLine: number;
      endLine: number;
      startColumn: number;
      endColumn: number;
      name: string | null;
      kind: string;
    }
  >;
  fileToChunks: Map<string, string[]>;
} | null = null;

/**
 * Clear the index cache (useful for testing)
 */
export function clearIndexCache(): void {
  indexCache = null;
}

/**
 * Find project root by looking for the .uilint directory (preferred)
 * or falling back to the root package.json (monorepo root)
 */
function findProjectRoot(startPath: string, indexPath: string): string {
  let current = startPath;
  let lastPackageJson: string | null = null;

  // Walk up the directory tree
  while (current !== dirname(current)) {
    // Check for .uilint directory with index (highest priority)
    const uilintDir = join(current, indexPath);
    if (existsSync(join(uilintDir, "manifest.json"))) {
      return current;
    }

    // Track package.json locations
    if (existsSync(join(current, "package.json"))) {
      lastPackageJson = current;
    }

    current = dirname(current);
  }

  // Return the topmost package.json location (monorepo root) or start path
  return lastPackageJson || startPath;
}

/**
 * Load the index into memory (cached across files)
 */
function loadIndex(
  projectRoot: string,
  indexPath: string
): typeof indexCache | null {
  const fullIndexPath = join(projectRoot, indexPath);
  log(`loadIndex called: projectRoot=${projectRoot}, indexPath=${indexPath}`);
  log(`fullIndexPath=${fullIndexPath}`);

  // Check if we already have a cached index for this project
  if (indexCache && indexCache.projectRoot === projectRoot) {
    log(`Using cached index (${indexCache.vectorStore.size} vectors, ${indexCache.fileToChunks.size} files)`);
    return indexCache;
  }

  // Check if index exists
  const manifestPath = join(fullIndexPath, "manifest.json");
  if (!existsSync(manifestPath)) {
    log(`Index not found: manifest.json missing at ${manifestPath}`);
    return null;
  }

  try {
    // Load metadata
    const metadataPath = join(fullIndexPath, "metadata.json");
    if (!existsSync(metadataPath)) {
      log(`Index not found: metadata.json missing at ${metadataPath}`);
      return null;
    }

    const metadataContent = readFileSync(metadataPath, "utf-8");
    const metadataJson = JSON.parse(metadataContent);

    // Support both formats: { entries: {...} } and direct { chunkId: {...} }
    const entries = metadataJson.entries || metadataJson;
    log(`Loaded metadata.json: ${Object.keys(entries).length} entries`);

    const metadataStore = new Map<
      string,
      {
        filePath: string;
        startLine: number;
        endLine: number;
        startColumn: number;
        endColumn: number;
        name: string | null;
        kind: string;
      }
    >();
    const fileToChunks = new Map<string, string[]>();

    for (const [id, meta] of Object.entries(entries)) {
      const m = meta as {
        filePath: string;
        startLine: number;
        endLine: number;
        startColumn: number;
        endColumn: number;
        name: string | null;
        kind: string;
      };
      metadataStore.set(id, {
        filePath: m.filePath,
        startLine: m.startLine,
        endLine: m.endLine,
        startColumn: m.startColumn ?? 0,
        endColumn: m.endColumn ?? 0,
        name: m.name,
        kind: m.kind,
      });

      // Build file -> chunks mapping
      const chunks = fileToChunks.get(m.filePath) || [];
      chunks.push(id);
      fileToChunks.set(m.filePath, chunks);
    }

    log(`File to chunks mapping:`);
    for (const [filePath, chunks] of fileToChunks.entries()) {
      log(`  ${filePath}: ${chunks.length} chunks (${chunks.join(", ")})`);
    }

    // Load vectors (binary format)
    const vectorsPath = join(fullIndexPath, "embeddings.bin");
    const idsPath = join(fullIndexPath, "ids.json");
    const vectorStore = new Map<string, number[]>();

    if (existsSync(vectorsPath) && existsSync(idsPath)) {
      const idsContent = readFileSync(idsPath, "utf-8");
      const ids = JSON.parse(idsContent) as string[];
      log(`Loaded ids.json: ${ids.length} IDs`);

      const buffer = readFileSync(vectorsPath);
      // Must use byteOffset and byteLength because Node's Buffer uses pooling
      // and buffer.buffer may contain data from other buffers at different offsets
      const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

      // Read header
      const dimension = view.getUint32(0, true);
      const count = view.getUint32(4, true);
      log(`Embeddings binary: dimension=${dimension}, count=${count}`);

      // Read vectors
      let offset = 8;
      for (let i = 0; i < count && i < ids.length; i++) {
        const vector: number[] = [];
        for (let j = 0; j < dimension; j++) {
          vector.push(view.getFloat32(offset, true));
          offset += 4;
        }
        vectorStore.set(ids[i], vector);
      }
      log(`Loaded ${vectorStore.size} vectors into store`);
    } else {
      log(`Missing vectors or ids files: vectorsPath=${existsSync(vectorsPath)}, idsPath=${existsSync(idsPath)}`);
    }

    indexCache = {
      projectRoot,
      vectorStore,
      metadataStore,
      fileToChunks,
    };

    log(`Index loaded successfully: ${vectorStore.size} vectors, ${metadataStore.size} metadata entries, ${fileToChunks.size} files`);
    return indexCache;
  } catch (err) {
    log(`Error loading index: ${err}`);
    return null;
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Find similar chunks to a given chunk
 */
function findSimilarChunks(
  index: NonNullable<typeof indexCache>,
  chunkId: string,
  threshold: number
): Array<{ id: string; score: number }> {
  log(`findSimilarChunks: chunkId=${chunkId}, threshold=${threshold}`);

  const vector = index.vectorStore.get(chunkId);
  if (!vector) {
    log(`  No vector found for chunk ${chunkId}`);
    return [];
  }
  log(`  Vector found: dimension=${vector.length}`);

  const results: Array<{ id: string; score: number }> = [];
  const allScores: Array<{ id: string; score: number }> = [];

  for (const [id, vec] of index.vectorStore.entries()) {
    if (id === chunkId) continue;

    const score = cosineSimilarity(vector, vec);
    allScores.push({ id, score });
    if (score >= threshold) {
      results.push({ id, score });
    }
  }

  // Log top 10 scores regardless of threshold
  const sortedAll = allScores.sort((a, b) => b.score - a.score).slice(0, 10);
  log(`  Top 10 similarity scores (threshold=${threshold}):`);
  for (const { id, score } of sortedAll) {
    const meta = index.metadataStore.get(id);
    const meetsThreshold = score >= threshold ? "✓" : "✗";
    log(`    ${meetsThreshold} ${(score * 100).toFixed(1)}% - ${id} (${meta?.name || "anonymous"} in ${meta?.filePath})`);
  }

  log(`  Found ${results.length} chunks above threshold`);
  return results.sort((a, b) => b.score - a.score);
}

export default createRule<Options, MessageIds>({
  name: "no-semantic-duplicates",
  meta: {
    type: "suggestion",
    docs: {
      description: "Warn when code is semantically similar to existing code",
    },
    messages: {
      semanticDuplicate:
        "This {{kind}} '{{name}}' is {{similarity}}% similar to '{{otherName}}' at {{otherLocation}}. Consider consolidating.",
      noIndex:
        "Semantic duplicates index not found. Run 'uilint duplicates index' first.",
    },
    schema: [
      {
        type: "object",
        properties: {
          threshold: {
            type: "number",
            minimum: 0,
            maximum: 1,
            description: "Similarity threshold (0-1)",
          },
          indexPath: {
            type: "string",
            description: "Path to the index directory",
          },
          minLines: {
            type: "integer",
            minimum: 1,
            description: "Minimum number of lines for a chunk to be reported",
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [
    {
      threshold: 0.85,
      indexPath: ".uilint/.duplicates-index",
      minLines: 3,
    },
  ],
  create(context) {
    const options = context.options[0] || {};
    const threshold = options.threshold ?? 0.85;
    const indexPath = options.indexPath ?? ".uilint/.duplicates-index";
    const minLines = options.minLines ?? 3;

    const filename = context.filename || context.getFilename();
    const projectRoot = findProjectRoot(dirname(filename), indexPath);

    // Initialize logging to .uilint folder
    initLog(projectRoot);

    log(`\n========== Rule create() ==========`);
    log(`Filename: ${filename}`);
    log(`Threshold: ${threshold}`);
    log(`Index path: ${indexPath}`);
    log(`Min lines: ${minLines}`);
    log(`Project root: ${projectRoot}`);

    const index = loadIndex(projectRoot, indexPath);

    // Track which chunks we've already reported to avoid duplicates
    const reportedChunks = new Set<string>();

    /**
     * Check if a node location corresponds to an indexed chunk
     * and if so, check for similar chunks
     */
    function checkForDuplicates(
      node: TSESTree.Node,
      name: string | null
    ): void {
      log(`checkForDuplicates: name=${name}, file=${filename}`);

      if (!index) {
        log(`  No index loaded`);
        return;
      }

      // Get chunks for this file
      const fileChunks = index.fileToChunks.get(filename);
      log(`  Looking for chunks for file: ${filename}`);
      log(`  Files in index: ${Array.from(index.fileToChunks.keys()).join(", ")}`);

      if (!fileChunks || fileChunks.length === 0) {
        log(`  No chunks found for this file`);
        return;
      }
      log(`  Found ${fileChunks.length} chunks: ${fileChunks.join(", ")}`);

      // Find the chunk that contains this node's location
      const nodeLine = node.loc?.start.line;
      if (!nodeLine) {
        log(`  No node line number`);
        return;
      }
      log(`  Node starts at line ${nodeLine}`);

      for (const chunkId of fileChunks) {
        if (reportedChunks.has(chunkId)) {
          log(`  Chunk ${chunkId} already reported, skipping`);
          continue;
        }

        const meta = index.metadataStore.get(chunkId);
        if (!meta) {
          log(`  No metadata for chunk ${chunkId}`);
          continue;
        }

        log(`  Checking chunk ${chunkId}: lines ${meta.startLine}-${meta.endLine} (node at line ${nodeLine})`);

        // Check if this node is within the chunk's line range
        if (nodeLine >= meta.startLine && nodeLine <= meta.endLine) {
          log(`  Node is within chunk range, searching for similar chunks...`);

          // Find similar chunks
          const similar = findSimilarChunks(index, chunkId, threshold);

          if (similar.length > 0) {
            const best = similar[0];
            const bestMeta = index.metadataStore.get(best.id);

            if (bestMeta) {
              // Check minimum lines threshold
              const chunkLines = meta.endLine - meta.startLine + 1;
              if (chunkLines < minLines) {
                log(`  Skipping: chunk has ${chunkLines} lines, below minLines=${minLines}`);
                continue;
              }

              reportedChunks.add(chunkId);

              const relPath = relative(projectRoot, bestMeta.filePath);
              const similarity = Math.round(best.score * 100);

              log(`  REPORTING: ${meta.kind} '${name || meta.name}' is ${similarity}% similar to '${bestMeta.name}' at ${relPath}:${bestMeta.startLine}`);

              context.report({
                node,
                loc: {
                  start: { line: meta.startLine, column: meta.startColumn },
                  end: { line: meta.endLine, column: meta.endColumn },
                },
                messageId: "semanticDuplicate",
                data: {
                  kind: meta.kind,
                  name: name || meta.name || "(anonymous)",
                  similarity: String(similarity),
                  otherName: bestMeta.name || "(anonymous)",
                  otherLocation: `${relPath}:${bestMeta.startLine}`,
                },
              });
            }
          } else {
            log(`  No similar chunks found above threshold`);
          }
        } else {
          log(`  Node line ${nodeLine} not in chunk range ${meta.startLine}-${meta.endLine}`);
        }
      }
    }

    return {
      // Check function declarations
      FunctionDeclaration(node) {
        const name = node.id?.name || null;
        checkForDuplicates(node, name);
      },

      // Check arrow functions assigned to variables
      "VariableDeclarator[init.type='ArrowFunctionExpression']"(
        node: TSESTree.VariableDeclarator
      ) {
        const name =
          node.id.type === "Identifier" ? node.id.name : null;
        if (node.init) {
          checkForDuplicates(node.init, name);
        }
      },

      // Check function expressions
      "VariableDeclarator[init.type='FunctionExpression']"(
        node: TSESTree.VariableDeclarator
      ) {
        const name =
          node.id.type === "Identifier" ? node.id.name : null;
        if (node.init) {
          checkForDuplicates(node.init, name);
        }
      },
    };
  },
});
