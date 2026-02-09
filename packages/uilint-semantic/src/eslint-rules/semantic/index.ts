/**
 * Rule: semantic
 *
 * LLM-powered semantic UI analysis using the project's styleguide.
 * This is the only rule that reads .uilint/styleguide.md.
 *
 * The rule itself is cache-only: it returns previously cached results
 * instantly (or nothing on cache miss). The actual LLM analysis runs
 * asynchronously in the WebSocket server and writes to the same cache,
 * so subsequent lint passes pick up the results without blocking.
 */

import { existsSync, readFileSync } from "fs";
import { dirname, join, relative } from "path";
import {
  createRule,
  defineRuleMeta,
  getCacheEntry,
  hashContentSync,
  getStyleguide,
} from "uilint-eslint";
import { UILINT_DEFAULT_OLLAMA_MODEL } from "uilint-core";

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
  category: "styleguide",
  icon: "🧠",
  hint: "LLM-powered UI analysis",
  defaultEnabled: false,
  requiresStyleguide: true,
  plugin: "styleguide",
  eslintImport: "uilint-semantic/eslint-rules/semantic",
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
    const { path: _styleguidePath, content: styleguide } = getStyleguide(
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

    // Cache-only: return cached results instantly, or nothing on miss.
    // The server runs the actual LLM analysis asynchronously and writes
    // to the same cache, so the next lint pass picks up the results.
    if (cached) {
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

    // Cache miss — return empty. The server will run async analysis
    // and populate the cache for the next lint pass.
    return {};
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

