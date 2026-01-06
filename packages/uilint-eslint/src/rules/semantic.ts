/**
 * Rule: semantic
 *
 * LLM-powered semantic UI analysis using the project's styleguide.
 * This is the only rule that reads .uilint/styleguide.md.
 */

import { readFileSync } from "fs";
import { dirname, relative } from "path";
import { createRule } from "../utils/create-rule.js";
import {
  getCacheEntry,
  hashContentSync,
  setCacheEntry,
  type CachedIssue,
} from "../utils/cache.js";
import { getStyleguide } from "../utils/styleguide-loader.js";

type MessageIds = "semanticIssue" | "styleguideNotFound" | "analysisError";
type Options = [
  {
    model?: string;
    styleguidePath?: string;
  },
];

// Store for async analysis results that will be reported on next lint
const pendingAnalysis = new Map<string, Promise<CachedIssue[]>>();

export default createRule<Options, MessageIds>({
  name: "semantic",
  meta: {
    type: "suggestion",
    docs: {
      description: "LLM-powered semantic UI analysis using styleguide",
    },
    messages: {
      semanticIssue: "{{message}}",
      styleguideNotFound:
        "No styleguide found. Create .uilint/styleguide.md or specify styleguidePath.",
      analysisError: "Semantic analysis failed: {{error}}",
    },
    schema: [
      {
        type: "object",
        properties: {
          model: {
            type: "string",
            description: "Ollama model to use",
          },
          styleguidePath: {
            type: "string",
            description: "Path to styleguide file",
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [{ model: "qwen3:8b" }],
  create(context) {
    const options = context.options[0] || {};
    const filePath = context.filename;
    const fileDir = dirname(filePath);

    // Get styleguide
    const { path: styleguidePath, content: styleguide } = getStyleguide(
      fileDir,
      options.styleguidePath
    );

    // Skip if no styleguide
    if (!styleguide) {
      return {
        Program(node) {
          context.report({
            node,
            messageId: "styleguideNotFound",
          });
        },
      };
    }

    // Read and hash file contents
    let fileContent: string;
    try {
      fileContent = readFileSync(filePath, "utf-8");
    } catch {
      return {};
    }

    const fileHash = hashContentSync(fileContent);
    const styleguideHash = hashContentSync(styleguide);

    // Check cache
    const projectRoot = findProjectRoot(fileDir);
    const relativeFilePath = relative(projectRoot, filePath);
    const cached = getCacheEntry(
      projectRoot,
      relativeFilePath,
      fileHash,
      styleguideHash
    );

    if (cached) {
      // Report cached issues
      return {
        Program(node) {
          for (const issue of cached.issues) {
            context.report({
              node,
              loc: { line: issue.line, column: issue.column || 0 },
              messageId: "semanticIssue",
              data: { message: issue.message },
            });
          }
        },
      };
    }

    // Queue async analysis (will be picked up on next lint)
    if (!pendingAnalysis.has(filePath)) {
      const analysisPromise = runSemanticAnalysis(
        fileContent,
        styleguide,
        options.model || "qwen3:8b"
      );

      pendingAnalysis.set(filePath, analysisPromise);

      // Store result in cache when complete
      analysisPromise
        .then((issues) => {
          setCacheEntry(projectRoot, relativeFilePath, {
            fileHash,
            styleguideHash,
            issues,
            timestamp: Date.now(),
          });
        })
        .catch(() => {
          // Ignore errors - will retry on next lint
        })
        .finally(() => {
          pendingAnalysis.delete(filePath);
        });
    }

    // No issues to report yet - will be cached for next run
    return {};
  },
});

/**
 * Find project root by looking for package.json
 */
function findProjectRoot(startDir: string): string {
  const { existsSync } = require("fs");
  const { dirname, join } = require("path");

  let dir = startDir;
  for (let i = 0; i < 20; i++) {
    if (existsSync(join(dir, "package.json"))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

/**
 * Run semantic analysis using Ollama
 */
async function runSemanticAnalysis(
  sourceCode: string,
  styleguide: string,
  model: string
): Promise<CachedIssue[]> {
  try {
    // Dynamic import of uilint-core to avoid circular dependencies at load time
    const { OllamaClient, buildSourceScanPrompt } = await import("uilint-core");

    const client = new OllamaClient({ model });

    // Check if Ollama is available
    const available = await client.isAvailable();
    if (!available) {
      console.warn("[uilint-eslint] Ollama not available, skipping semantic analysis");
      return [];
    }

    const prompt = buildSourceScanPrompt(sourceCode, styleguide, {});
    const response = await client.complete(prompt, { json: true });

    const parsed = JSON.parse(response) as {
      issues?: Array<{ line?: number; column?: number; message?: string }>;
    };

    return (parsed.issues || []).map((issue) => ({
      line: issue.line || 1,
      column: issue.column,
      message: issue.message || "Semantic issue detected",
      ruleId: "uilint/semantic",
      severity: 1 as const,
    }));
  } catch (error) {
    console.error("[uilint-eslint] Semantic analysis error:", error);
    return [];
  }
}
