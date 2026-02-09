/**
 * Rule: no-duplicates
 *
 * Warns when code is semantically similar to existing indexed code.
 * This rule queries a pre-built semantic index (from uilint duplicates index)
 * rather than calling the LLM during linting - making it fast.
 *
 * Prerequisites:
 * - Run `uilint duplicates index` to build the semantic index first
 * - The index is stored at .uilint/.duplicates-index/
 */

import { createRule, defineRuleMeta } from "uilint-eslint";
import type { TSESTree } from "@typescript-eslint/utils";
import { existsSync, readFileSync, appendFileSync, writeFileSync } from "fs";
import { dirname, join, relative } from "path";

// Debug logging - writes to .uilint/no-duplicates.log in the project root
let logFile: string | null = null;
let logInitialized = false;

function initLog(projectRoot: string): void {
  if (logFile) return;
  const uilintDir = join(projectRoot, ".uilint");
  if (existsSync(uilintDir)) {
    logFile = join(uilintDir, "no-duplicates.log");
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
    /** Similarity threshold (0-1). Default: 0.75 */
    threshold?: number;
    /** Path to the index directory */
    indexPath?: string;
    /** Minimum number of lines for a chunk to be reported (default: 3) */
    minLines?: number;
    /** Minimum confidence level to report: "high", "medium", "low". Default: "low" */
    confidenceLevel?: "high" | "medium" | "low";
    /** Use structural similarity boost (props, JSX, hooks overlap). Default: true */
    useStructuralBoost?: boolean;
    /** Include duplicates within the same file. Default: false */
    includeSameFile?: boolean;
    /** Filter by code kind: "component", "hook", "function", or "all". Default: "all" */
    kind?: "component" | "hook" | "function" | "all";
  }
];

/**
 * Rule metadata
 */
export const meta = defineRuleMeta({
  id: "no-duplicates",
  version: "1.0.0",
  name: "No Duplicates",
  description: "Warn when code is semantically similar to existing code",
  defaultSeverity: "warn",
  category: "duplicates",
  icon: "🔍",
  hint: "Finds similar code via embeddings",
  defaultEnabled: false,
  plugin: "duplicates",
  eslintImport: "uilint-duplicates/eslint-rules/no-duplicates",
  customInspector: "duplicates",
  requirements: [
    {
      type: "semantic-index",
      description: "Requires semantic index for duplicate detection",
      setupHint: "Run: uilint duplicates index",
    },
  ],
  postInstallInstructions: "Run 'uilint duplicates index' to build the semantic index before using this rule.",
  defaultOptions: [{
    threshold: 0.75,
    indexPath: ".uilint/.duplicates-index",
    minLines: 3,
    confidenceLevel: "low",
    useStructuralBoost: true,
    includeSameFile: false,
    kind: "all",
  }],
  optionSchema: {
    fields: [
      {
        key: "threshold",
        label: "Similarity threshold",
        type: "number",
        defaultValue: 0.75,
        description:
          "Minimum similarity score (0-1) to report as duplicate. Lower values catch more potential duplicates. Recommended: 0.75 (default), 0.85 (strict), 0.65 (lenient).",
      },
      {
        key: "confidenceLevel",
        label: "Minimum confidence",
        type: "select",
        defaultValue: "low",
        options: [
          { value: "high", label: "High (≥90%) - Likely copy-paste" },
          { value: "medium", label: "Medium (≥75%) - Semantically similar" },
          { value: "low", label: "Low (≥60%) - Possibly related" },
        ],
        description:
          "Only report duplicates at or above this confidence level. High = fewer but more certain matches.",
      },
      {
        key: "useStructuralBoost",
        label: "Use structural similarity",
        type: "boolean",
        defaultValue: true,
        description:
          "Boost similarity scores based on structural overlap (props, JSX elements, hooks). Helps catch duplicates with different variable names.",
      },
      {
        key: "kind",
        label: "Code kind filter",
        type: "select",
        defaultValue: "all",
        options: [
          { value: "all", label: "All code" },
          { value: "component", label: "Components only" },
          { value: "hook", label: "Hooks only" },
          { value: "function", label: "Functions only" },
        ],
        description:
          "Only detect duplicates of a specific code type.",
      },
      {
        key: "includeSameFile",
        label: "Include same-file duplicates",
        type: "boolean",
        defaultValue: false,
        description:
          "Report duplicates within the same file (e.g., Card and CardAlt in cards.tsx).",
      },
      {
        key: "indexPath",
        label: "Index path",
        type: "text",
        defaultValue: ".uilint/.duplicates-index",
        description: "Path to the semantic duplicates index directory.",
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
"uilint/no-duplicates": ["warn", {
  // Core detection settings
  threshold: 0.75,              // Similarity threshold (0-1). Lower = more matches.
  confidenceLevel: "medium",    // "high" (≥90%), "medium" (≥75%), "low" (≥60%)

  // Detection enhancements
  useStructuralBoost: true,     // Boost scores based on props/JSX/hooks overlap

  // Filtering
  kind: "all",                  // "all", "component", "hook", "function"
  includeSameFile: false,       // Include duplicates within the same file
  minLines: 3,                  // Minimum lines to report

  // Index location
  indexPath: ".uilint/.duplicates-index"
}]
\`\`\`

### Preset configurations

**Strict** - High-confidence duplicates only:
\`\`\`js
{ threshold: 0.85, confidenceLevel: "high" }
\`\`\`

**Normal** (default) - Balanced detection:
\`\`\`js
{ threshold: 0.75, confidenceLevel: "low" }
\`\`\`

**Lenient** - Catch more potential duplicates:
\`\`\`js
{ threshold: 0.65, confidenceLevel: "low" }
\`\`\`

## Confidence Levels

The rule assigns confidence levels based on similarity scores:

- 🔴 **High (≥90%)** - Likely copy-paste or near-identical code. Strongly recommend consolidation.
- 🟡 **Medium (75-89%)** - Semantically similar. Review for potential abstraction.
- 🟢 **Low (60-74%)** - Possibly related patterns. Optional review.

## Notes

- Run \`uilint duplicates index\` after significant code changes
- Use \`uilint duplicates find\` to explore all duplicate groups
- The rule only reports if the file is in the index
- Structural boost helps detect duplicates with different variable names (e.g., Badge vs Tag)
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
 * Extract code from a file for a given line range
 */
function extractCodeFromFile(
  filePath: string,
  startLine: number,
  endLine: number
): string | null {
  try {
    if (!existsSync(filePath)) {
      return null;
    }
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    // Convert to 0-indexed and extract the range
    const start = Math.max(0, startLine - 1);
    const end = Math.min(lines.length, endLine);
    return lines.slice(start, end).join("\n");
  } catch {
    return null;
  }
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
  name: "no-duplicates",
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
          confidenceLevel: {
            type: "string",
            enum: ["high", "medium", "low"],
            description: "Minimum confidence level to report",
          },
          useStructuralBoost: {
            type: "boolean",
            description: "Use structural similarity boost (props, JSX, hooks overlap)",
          },
          includeSameFile: {
            type: "boolean",
            description: "Include duplicates within the same file",
          },
          kind: {
            type: "string",
            enum: ["component", "hook", "function", "all"],
            description: "Filter by code kind",
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [
    {
      threshold: 0.75,
      indexPath: ".uilint/.duplicates-index",
      minLines: 3,
      confidenceLevel: "low" as const,
      useStructuralBoost: true,
      includeSameFile: false,
      kind: "all" as const,
    },
  ],
  create(context) {
    const options = context.options[0] || {};
    const threshold = options.threshold ?? 0.85;
    const indexPath = options.indexPath ?? ".uilint/.duplicates-index";
    const minLines = options.minLines ?? 3;

    const filename = context.filename || context.getFilename();
    const projectRoot = findProjectRoot(dirname(filename), indexPath);

    // Convert to relative path for index lookup (index stores relative paths for portability)
    const relativeFilename = relative(projectRoot, filename);

    // Initialize logging to .uilint folder
    initLog(projectRoot);

    log(`\n========== Rule create() ==========`);
    log(`Filename: ${filename}`);
    log(`Relative filename: ${relativeFilename}`);
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
      log(`checkForDuplicates: name=${name}, file=${relativeFilename}`);

      if (!index) {
        log(`  No index loaded`);
        return;
      }

      // Get chunks for this file (using relative path for portability)
      const fileChunks = index.fileToChunks.get(relativeFilename);
      log(`  Looking for chunks for file: ${relativeFilename}`);
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

              // Index stores relative paths, so bestMeta.filePath is already relative
              const relPath = bestMeta.filePath;
              const similarity = Math.round(best.score * 100);

              // Extract source code for both chunks
              // For source file, use absolute path (filename is absolute from context)
              const sourceCode = extractCodeFromFile(
                filename,
                meta.startLine,
                meta.endLine
              );
              // For target file, convert relative path back to absolute for reading
              const targetAbsolutePath = join(projectRoot, bestMeta.filePath);
              const targetCode = extractCodeFromFile(
                targetAbsolutePath,
                bestMeta.startLine,
                bestMeta.endLine
              );

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
                  // Extended data for inspector panel (use relative paths for portability)
                  sourceCode: sourceCode || "",
                  targetCode: targetCode || "",
                  sourceLocation: JSON.stringify({
                    filePath: relativeFilename,
                    startLine: meta.startLine,
                    endLine: meta.endLine,
                    startColumn: meta.startColumn,
                    endColumn: meta.endColumn,
                  }),
                  targetLocation: JSON.stringify({
                    filePath: bestMeta.filePath, // Already relative from index
                    startLine: bestMeta.startLine,
                    endLine: bestMeta.endLine,
                    startColumn: bestMeta.startColumn,
                    endColumn: bestMeta.endColumn,
                  }),
                  sourceName: name || meta.name || "(anonymous)",
                  targetName: bestMeta.name || "(anonymous)",
                  similarityScore: String(best.score),
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
