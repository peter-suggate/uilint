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
import { existsSync, readFileSync } from "fs";
import { dirname, join, relative } from "path";

type MessageIds = "semanticDuplicate" | "noIndex";
type Options = [
  {
    /** Similarity threshold (0-1). Default: 0.85 */
    threshold?: number;
    /** Path to the index directory */
    indexPath?: string;
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
  defaultOptions: [{ threshold: 0.85, indexPath: ".uilint/.duplicates-index" }],
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
  indexPath: ".uilint/.duplicates-index"
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
      name: string | null;
      kind: string;
    }
  >;
  fileToChunks: Map<string, string[]>;
} | null = null;

/**
 * Find project root by looking for package.json
 */
function findProjectRoot(startPath: string): string {
  let current = startPath;
  while (current !== dirname(current)) {
    if (existsSync(join(current, "package.json"))) {
      return current;
    }
    current = dirname(current);
  }
  return startPath;
}

/**
 * Load the index into memory (cached across files)
 */
function loadIndex(
  projectRoot: string,
  indexPath: string
): typeof indexCache | null {
  const fullIndexPath = join(projectRoot, indexPath);

  // Check if we already have a cached index for this project
  if (indexCache && indexCache.projectRoot === projectRoot) {
    return indexCache;
  }

  // Check if index exists
  const manifestPath = join(fullIndexPath, "manifest.json");
  if (!existsSync(manifestPath)) {
    return null;
  }

  try {
    // Load metadata
    const metadataPath = join(fullIndexPath, "metadata.json");
    if (!existsSync(metadataPath)) {
      return null;
    }

    const metadataContent = readFileSync(metadataPath, "utf-8");
    const metadataJson = JSON.parse(metadataContent);

    const metadataStore = new Map<
      string,
      {
        filePath: string;
        startLine: number;
        endLine: number;
        name: string | null;
        kind: string;
      }
    >();
    const fileToChunks = new Map<string, string[]>();

    for (const [id, meta] of Object.entries(metadataJson.entries || {})) {
      const m = meta as {
        filePath: string;
        startLine: number;
        endLine: number;
        name: string | null;
        kind: string;
      };
      metadataStore.set(id, m);

      // Build file -> chunks mapping
      const chunks = fileToChunks.get(m.filePath) || [];
      chunks.push(id);
      fileToChunks.set(m.filePath, chunks);
    }

    // Load vectors (binary format)
    const vectorsPath = join(fullIndexPath, "embeddings.bin");
    const idsPath = join(fullIndexPath, "ids.json");
    const vectorStore = new Map<string, number[]>();

    if (existsSync(vectorsPath) && existsSync(idsPath)) {
      const idsContent = readFileSync(idsPath, "utf-8");
      const ids = JSON.parse(idsContent) as string[];

      const buffer = readFileSync(vectorsPath);
      const view = new DataView(buffer.buffer);

      // Read header
      const dimension = view.getUint32(0, true);
      const count = view.getUint32(4, true);

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
    }

    indexCache = {
      projectRoot,
      vectorStore,
      metadataStore,
      fileToChunks,
    };

    return indexCache;
  } catch {
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
  const vector = index.vectorStore.get(chunkId);
  if (!vector) return [];

  const results: Array<{ id: string; score: number }> = [];

  for (const [id, vec] of index.vectorStore.entries()) {
    if (id === chunkId) continue;

    const score = cosineSimilarity(vector, vec);
    if (score >= threshold) {
      results.push({ id, score });
    }
  }

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
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [
    {
      threshold: 0.85,
      indexPath: ".uilint/.duplicates-index",
    },
  ],
  create(context) {
    const options = context.options[0] || {};
    const threshold = options.threshold ?? 0.85;
    const indexPath = options.indexPath ?? ".uilint/.duplicates-index";

    const filename = context.filename || context.getFilename();
    const projectRoot = findProjectRoot(dirname(filename));
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
      if (!index) {
        return;
      }

      // Get chunks for this file
      const fileChunks = index.fileToChunks.get(filename);
      if (!fileChunks || fileChunks.length === 0) {
        return;
      }

      // Find the chunk that contains this node's location
      const nodeLine = node.loc?.start.line;
      if (!nodeLine) return;

      for (const chunkId of fileChunks) {
        if (reportedChunks.has(chunkId)) continue;

        const meta = index.metadataStore.get(chunkId);
        if (!meta) continue;

        // Check if this node is within the chunk's line range
        if (nodeLine >= meta.startLine && nodeLine <= meta.endLine) {
          // Find similar chunks
          const similar = findSimilarChunks(index, chunkId, threshold);

          if (similar.length > 0) {
            const best = similar[0];
            const bestMeta = index.metadataStore.get(best.id);

            if (bestMeta) {
              reportedChunks.add(chunkId);

              const relPath = relative(projectRoot, bestMeta.filePath);
              const similarity = Math.round(best.score * 100);

              context.report({
                node,
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
          }
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
