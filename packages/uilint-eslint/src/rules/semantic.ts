/**
 * Rule: semantic
 *
 * LLM-powered semantic UI analysis using the project's styleguide.
 * This is the only rule that reads .uilint/styleguide.md.
 */

import { existsSync, readFileSync } from "fs";
import { spawnSync } from "child_process";
import { dirname, join, relative } from "path";
import { createRule } from "../utils/create-rule.js";
import {
  getCacheEntry,
  hashContentSync,
  setCacheEntry,
  type CachedIssue,
} from "../utils/cache.js";
import { getStyleguide } from "../utils/styleguide-loader.js";
import { UILINT_DEFAULT_OLLAMA_MODEL } from "uilint-core";
import { buildSourceScanPrompt } from "uilint-core";

type MessageIds = "semanticIssue" | "styleguideNotFound" | "analysisError";
type Options = [
  {
    model?: string;
    styleguidePath?: string;
  }
];

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
  defaultOptions: [{ model: UILINT_DEFAULT_OLLAMA_MODEL }],
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
      console.error(
        `[uilint] Styleguide not found (styleguidePath=${String(
          options.styleguidePath ?? ""
        )}, startDir=${fileDir})`
      );

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
      console.error(`[uilint] Failed to read file ${filePath}`);
      return {
        Program(node) {
          context.report({
            node,
            messageId: "analysisError",
            data: { error: `Failed to read source file ${filePath}` },
          });
        },
      };
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

    const ENABLE_CACHE = false;
    if (ENABLE_CACHE && cached) {
      console.error(`[uilint] Cache hit for ${filePath}`);

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

    // Cache miss: run sync analysis now (slow), cache, then report.
    ENABLE_CACHE &&
      console.error(
        `[uilint] Cache miss for ${filePath}, running semantic analysis`
      );

    return {
      Program(node) {
        const issues = runSemanticAnalysisSync(
          fileContent,
          styleguide,
          options.model || UILINT_DEFAULT_OLLAMA_MODEL,
          filePath
        );

        setCacheEntry(projectRoot, relativeFilePath, {
          fileHash,
          styleguideHash,
          issues,
          timestamp: Date.now(),
        });

        for (const issue of issues) {
          context.report({
            node,
            loc: { line: issue.line, column: issue.column || 0 },
            messageId: "semanticIssue",
            data: { message: issue.message },
          });
        }
      },
    };
  },
});

/**
 * Find project root by looking for package.json
 */
function findProjectRoot(startDir: string): string {
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
 * Run semantic analysis using Ollama (synchronously).
 *
 * Implementation detail:
 * - ESLint rules are synchronous.
 * - Blocking on a Promise (sleep-loop/Atomics) would also block Node's event loop,
 *   preventing the HTTP request to Ollama from ever completing.
 * - To keep this simple & debuggable, we run the async LLM call in a child Node
 *   process and synchronously wait for it to exit.
 */
function runSemanticAnalysisSync(
  sourceCode: string,
  styleguide: string,
  model: string,
  filePath?: string
): CachedIssue[] {
  const startTime = Date.now();
  const fileDisplay = filePath ? ` ${filePath}` : "";

  console.error(`[uilint] Starting semantic analysis (sync)${fileDisplay}`);
  console.error(`[uilint] Model: ${model}`);

  // Build prompt in-process (pure string building).
  const prompt = buildSourceScanPrompt(sourceCode, styleguide, {});

  // Avoid `uilint-core/node` exports *and* CJS resolution:
  // resolve the installed dependency by file URL relative to this plugin bundle.
  // When built, `import.meta.url` points at `.../uilint-eslint/dist/index.js`,
  // and the dependency lives at `.../uilint-eslint/node_modules/uilint-core/dist/node.js`.
  const coreNodeUrl = new URL(
    "../node_modules/uilint-core/dist/node.js",
    import.meta.url
  ).href;

  const childScript = `
    import * as coreNode from ${JSON.stringify(coreNodeUrl)};
    const { OllamaClient, logInfo, logWarning, createProgress, pc } = coreNode;
    const chunks = [];
    for await (const c of process.stdin) chunks.push(c);
    const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const model = input.model;
    const prompt = input.prompt;

    const client = new OllamaClient({ model });
    const ok = await client.isAvailable();
    if (!ok) {
      logWarning("Ollama not available, skipping semantic analysis");
      process.stdout.write(JSON.stringify({ issues: [] }));
      process.exit(0);
    }

    logInfo(\`Ollama connected \${pc.dim(\`(model: \${model})\`)}\`);
    const progress = createProgress("Analyzing with LLM...");
    try {
      const response = await client.complete(prompt, {
        json: true,
        stream: true,
        onProgress: (latestLine) => {
          const maxLen = 60;
          const display =
            latestLine.length > maxLen
              ? latestLine.slice(0, maxLen) + "…"
              : latestLine;
          progress.update(\`LLM: \${pc.dim(display || "...")}\`);
        },
      });
      progress.succeed("LLM complete");
      process.stdout.write(response);
    } catch (e) {
      progress.fail(\`LLM failed: \${e instanceof Error ? e.message : String(e)}\`);
      process.exit(1);
    }
  `;

  const child = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", childScript],
    {
      input: JSON.stringify({ model, prompt }),
      encoding: "utf8",
      stdio: ["pipe", "pipe", "inherit"],
      maxBuffer: 20 * 1024 * 1024,
    }
  );

  const elapsed = Date.now() - startTime;

  if (child.error) {
    console.error(
      `[uilint] Semantic analysis failed after ${elapsed}ms: ${child.error.message}`
    );
    return [];
  }

  if (typeof child.status === "number" && child.status !== 0) {
    console.error(
      `[uilint] Semantic analysis failed after ${elapsed}ms: child exited ${child.status}`
    );
    return [];
  }

  const responseText = (child.stdout || "").trim();
  if (!responseText) {
    console.error(
      `[uilint] Semantic analysis returned empty response (${elapsed}ms)`
    );
    return [];
  }

  try {
    const parsed = JSON.parse(responseText) as {
      issues?: Array<{ line?: number; column?: number; message?: string }>;
    };

    const issues = (parsed.issues || []).map((issue) => ({
      line: issue.line || 1,
      column: issue.column,
      message: issue.message || "Semantic issue detected",
      ruleId: "uilint/semantic",
      severity: 1 as const,
    }));

    if (issues.length > 0) {
      console.error(`[uilint] Found ${issues.length} issue(s) (${elapsed}ms)`);
    } else {
      console.error(`[uilint] No issues found (${elapsed}ms)`);
    }

    return issues;
  } catch (e) {
    console.error(
      `[uilint] Semantic analysis failed to parse response after ${elapsed}ms: ${
        e instanceof Error ? e.message : String(e)
      }`
    );
    return [];
  }
}
