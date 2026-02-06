/**
 * Rule: semantic
 *
 * LLM-powered semantic UI analysis using the project's styleguide.
 * This is the only rule that reads .uilint/styleguide.md.
 */

import { existsSync, readFileSync } from "fs";
import { spawnSync } from "child_process";
import { dirname, join, relative } from "path";
import { createRule, defineRuleMeta } from "../../utils/create-rule.js";
import {
  getCacheEntry,
  hashContentSync,
  setCacheEntry,
  type CachedIssue,
} from "./lib/cache.js";
import { getStyleguide } from "./lib/styleguide-loader.js";
import { UILINT_DEFAULT_OLLAMA_MODEL } from "uilint-core";
import { buildSourceScanPrompt } from "uilint-core";

type MessageIds = "semanticIssue" | "styleguideNotFound" | "analysisError";
type Options = [
  {
    model?: string;
    styleguidePath?: string;
  }
];

/**
 * Rule metadata - colocated with implementation for maintainability
 */
export const meta = defineRuleMeta({
  id: "semantic",
  version: "1.0.0",
  name: "Semantic Analysis",
  description: "LLM-powered semantic UI analysis using your styleguide",
  defaultSeverity: "warn",
  category: "semantic",
  icon: "🧠",
  hint: "LLM-powered UI analysis",
  defaultEnabled: false,
  requiresStyleguide: true,
  plugin: "semantic",
  customInspector: "semantic-issue",
  requirements: [
    {
      type: "ollama",
      description: "Requires Ollama running locally",
      setupHint: "Run: ollama serve && ollama pull qwen3-vl:8b-instruct",
    },
    {
      type: "styleguide",
      description: "Requires a styleguide file",
      setupHint: "Run: uilint genstyleguide",
    },
  ],
  npmDependencies: ["xxhash-wasm"],
  defaultOptions: [
    { model: "qwen3-vl:8b-instruct", styleguidePath: ".uilint/styleguide.md" },
  ],
  optionSchema: {
    fields: [
      {
        key: "model",
        label: "Ollama model to use",
        type: "text",
        defaultValue: "qwen3-vl:8b-instruct",
        placeholder: "qwen3-vl:8b-instruct",
        description: "The Ollama model name for semantic analysis",
      },
      {
        key: "styleguidePath",
        label: "Path to styleguide file",
        type: "text",
        defaultValue: ".uilint/styleguide.md",
        placeholder: ".uilint/styleguide.md",
        description: "Relative path to the styleguide markdown file",
      },
    ],
  },
  docs: `
## What it does

Uses a local LLM (via Ollama) to analyze your React components against your project's
styleguide. It catches semantic issues that pattern-based rules can't detect, like:
- Using incorrect spacing that doesn't match your design system conventions
- Inconsistent button styles across similar contexts
- Missing accessibility patterns defined in your styleguide

## Why it's useful

- **Custom rules**: Enforces your project's unique conventions without writing custom ESLint rules
- **Context-aware**: Understands component intent, not just syntax
- **Evolving standards**: Update your styleguide, and the rule adapts automatically
- **Local & private**: Runs entirely on your machine using Ollama

## Prerequisites

1. **Ollama installed**: \`brew install ollama\` or from ollama.ai
2. **Model pulled**: \`ollama pull qwen3-vl:8b-instruct\` (or your preferred model)
3. **Styleguide created**: Create \`.uilint/styleguide.md\` describing your conventions

## Example Styleguide

\`\`\`markdown
# UI Style Guide

## Spacing
- Use gap-4 for spacing between card elements
- Use py-2 px-4 for button padding

## Colors
- Primary actions: bg-primary text-primary-foreground
- Destructive actions: bg-destructive text-destructive-foreground

## Components
- All forms must include a Cancel button
- Modal headers should use text-lg font-semibold
\`\`\`

## Configuration

\`\`\`js
// eslint.config.js
"uilint/semantic": ["warn", {
  model: "qwen3-vl:8b-instruct",           // Ollama model name
  styleguidePath: ".uilint/styleguide.md"  // Path to styleguide
}]
\`\`\`

## Notes

- Results are cached based on file content and styleguide hash
- First run may be slow as the model loads; subsequent runs use cache
- Works best with detailed, specific styleguide documentation
- Set to "off" in CI to avoid slow builds (use pre-commit hooks locally)
`,
  isDirectoryBased: true,
  sentinelMessageIds: ["analysisError"],
});

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
          if (issue.message.startsWith("[SEMANTIC_ERROR] ")) {
            context.report({
              node,
              messageId: "analysisError",
              data: { error: issue.message.slice("[SEMANTIC_ERROR] ".length) },
            });
          } else {
            context.report({
              node,
              loc: { line: issue.line, column: issue.column || 0 },
              messageId: "semanticIssue",
              data: { message: issue.message },
            });
          }
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

  // Debug logging suppressed — errors flow through sentinel issues to the dashboard.

  // Build prompt in-process (pure string building).
  const prompt = buildSourceScanPrompt(sourceCode, styleguide, {});

  // Resolve uilint-core/node for the child process.
  // We use import.meta.resolve (Node 20+) to find the actual module through
  // Node's resolution system, which works regardless of where this rule file
  // is loaded from (e.g., .uilint/rules/ copies vs uilint-eslint/dist/).
  // Fallback to relative path from import.meta.url for older Node versions.
  let coreNodeUrl: string;
  try {
    coreNodeUrl = import.meta.resolve("uilint-core/node");
  } catch {
    // Fallback: relative resolution from this file's location
    coreNodeUrl = new URL(
      "../node_modules/uilint-core/dist/node.js",
      import.meta.url
    ).href;
  }

  const childScript = `
    import * as coreNode from ${JSON.stringify(coreNodeUrl)};
    const { OllamaClient, logInfo, logWarning } = coreNode;
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

    logInfo(\`Ollama connected (model: \${model})\`);
    logInfo("Analyzing with LLM...");
    try {
      const response = await client.complete(prompt, { json: true });
      logInfo("LLM complete");
      process.stdout.write(response);
    } catch (e) {
      logWarning(\`LLM failed: \${e instanceof Error ? e.message : String(e)}\`);
      process.exit(1);
    }
  `;

  const child = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", childScript],
    {
      input: JSON.stringify({ model, prompt }),
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 20 * 1024 * 1024,
    }
  );

  const elapsed = Date.now() - startTime;

  const childStderr = (child.stderr || "").trim();

  if (child.error) {
    const detail = [
      child.error.message,
      childStderr ? `stderr: ${childStderr}` : null,
      `model: ${model}`,
      `elapsed: ${elapsed}ms`,
    ]
      .filter(Boolean)
      .join(" | ");
    // Error detail flows through the sentinel issue to the dashboard.
    return [
      {
        line: 1,
        column: 0,
        message: `[SEMANTIC_ERROR] ${detail}`,
        ruleId: "uilint/semantic",
        severity: 1 as const,
      },
    ];
  }

  if (typeof child.status === "number" && child.status !== 0) {
    const detail = [
      `child exited ${child.status}`,
      childStderr ? `stderr: ${childStderr}` : null,
      `model: ${model}`,
      `elapsed: ${elapsed}ms`,
    ]
      .filter(Boolean)
      .join(" | ");
    // Error detail flows through the sentinel issue to the dashboard.
    return [
      {
        line: 1,
        column: 0,
        message: `[SEMANTIC_ERROR] ${detail}`,
        ruleId: "uilint/semantic",
        severity: 1 as const,
      },
    ];
  }

  const responseText = (child.stdout || "").trim();
  if (!responseText) {
    const detail = [
      "empty response",
      childStderr ? `stderr: ${childStderr}` : null,
      `model: ${model}`,
      `elapsed: ${elapsed}ms`,
    ]
      .filter(Boolean)
      .join(" | ");
    // Error detail flows through the sentinel issue to the dashboard.
    return [
      {
        line: 1,
        column: 0,
        message: `[SEMANTIC_ERROR] ${detail}`,
        ruleId: "uilint/semantic",
        severity: 1 as const,
      },
    ];
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

    // Success info suppressed — results flow through ESLint to the dashboard.

    return issues;
  } catch (e) {
    const parseError = e instanceof Error ? e.message : String(e);
    const detail = [
      `parse error: ${parseError}`,
      childStderr ? `stderr: ${childStderr}` : null,
      `model: ${model}`,
      `elapsed: ${elapsed}ms`,
    ]
      .filter(Boolean)
      .join(" | ");
    // Error detail flows through the sentinel issue to the dashboard.
    return [
      {
        line: 1,
        column: 0,
        message: `[SEMANTIC_ERROR] ${detail}`,
        ruleId: "uilint/semantic",
        severity: 1 as const,
      },
    ];
  }
}
