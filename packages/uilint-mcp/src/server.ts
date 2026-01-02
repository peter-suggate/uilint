#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { findStyleGuidePath, readStyleGuide } from "uilint-core/node";
import { queryStyleGuide } from "./tools/query-styleguide.js";
import { scanSnippet } from "./tools/scan-snippet.js";
import { scanFile, type FileAnalysisResult } from "./tools/scan-file.js";
import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

function getServerVersion(): string {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(__dirname, "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
      version?: string;
    };
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const server = new Server(
  {
    name: "uilint-mcp",
    version: getServerVersion(),
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "query_styleguide",
        description:
          "Query the UI style guide for specific rules. Use this to check allowed colors, fonts, spacing values, or component patterns before generating UI code.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description:
                'What to query, e.g., "what colors are allowed?", "what is the primary font?", "what spacing values should I use?"',
            },
            styleguidePath: {
              type: "string",
              description:
                "Full path to the style guide markdown file (e.g. /abs/path/.uilint/styleguide.md).",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "scan_snippet",
        description:
          "Scan a markup snippet (best-effort HTML/JSX-ish) and return UI consistency issues using the scan/analyze pipeline.",
        inputSchema: {
          type: "object",
          properties: {
            markup: {
              type: "string",
              description: "The markup snippet to scan",
            },
            styleguidePath: {
              type: "string",
              description:
                "Full path to the style guide markdown file (e.g. /abs/path/.uilint/styleguide.md).",
            },
            model: {
              type: "string",
              description: "Ollama model to use (optional)",
            },
          },
          required: ["markup"],
        },
      },
      {
        name: "scan_file",
        description:
          "Scan a UI file (TSX, JSX, HTML) for consistency issues against the style guide. Reads the file from disk and analyzes it with an LLM. Use this after editing UI files to check for style violations.",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description:
                "Path to the file to scan. Can be absolute or relative to the MCP server's current working directory.",
            },
            styleguidePath: {
              type: "string",
              description:
                "Full path to the style guide markdown file (e.g. /abs/path/.uilint/styleguide.md).",
            },
            model: {
              type: "string",
              description: "Ollama model to use (optional)",
            },
          },
          required: ["filePath"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Find and read the style guide.
    // Prefer explicit styleguidePath (robust for monorepos / subdir apps),
    // but keep cwd-based lookup as a fallback.
    const serverCwd = process.cwd();
    const explicitStyleguidePath = (args?.styleguidePath as string) || "";

    let styleGuide: string | null = null;
    if (explicitStyleguidePath && explicitStyleguidePath.trim()) {
      const p = explicitStyleguidePath.trim();
      styleGuide = existsSync(p) ? await readStyleGuide(p) : null;
    } else {
      const styleGuidePath = findStyleGuidePath(serverCwd);
      styleGuide = styleGuidePath ? await readStyleGuide(styleGuidePath) : null;
    }

    switch (name) {
      case "query_styleguide": {
        const query = args?.query as string;
        if (!query) {
          return {
            content: [
              { type: "text", text: "Error: query parameter is required" },
            ],
            isError: true,
          };
        }
        const result = await queryStyleGuide(query, styleGuide);
        return {
          content: [{ type: "text", text: result }],
        };
      }

      case "scan_snippet": {
        const markup = args?.markup as string;
        if (!markup) {
          return {
            content: [
              { type: "text", text: "Error: markup parameter is required" },
            ],
            isError: true,
          };
        }
        const model = args?.model as string | undefined;

        const tailwindSearchPath =
          explicitStyleguidePath && explicitStyleguidePath.trim()
            ? dirname(explicitStyleguidePath.trim())
            : serverCwd;

        const result = await scanSnippet(markup, styleGuide, {
          tailwindSearchPath,
          model,
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

      case "scan_file": {
        const filePath = args?.filePath as string;
        if (!filePath) {
          return {
            content: [
              { type: "text", text: "Error: filePath parameter is required" },
            ],
            isError: true,
          };
        }
        const model = args?.model as string | undefined;
        const result = await scanFile(filePath, styleGuide, {
          model,
        });

        // Format the result nicely
        if (result.error) {
          return {
            content: [{ type: "text", text: `Error: ${result.error}` }],
            isError: true,
          };
        }

        if (result.issues.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `✓ No UI consistency issues found in ${filePath}\n\nAnalysis time: ${result.analysisTime}ms`,
              },
            ],
          };
        }

        // Format issues
        const issueLines = result.issues.map((issue, i) => {
          let line = `${i + 1}. [${issue.type}] ${issue.message}`;
          if (issue.currentValue && issue.expectedValue) {
            line += `\n   ${issue.currentValue} → ${issue.expectedValue}`;
          }
          if (issue.suggestion) {
            line += `\n   💡 ${issue.suggestion}`;
          }
          return line;
        });

        return {
          content: [
            {
              type: "text",
              text: `Found ${
                result.issues.length
              } issue(s) in ${filePath}:\n\n${issueLines.join(
                "\n\n"
              )}\n\nAnalysis time: ${result.analysisTime}ms`,
            },
          ],
        };
      }

      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("UILint MCP server started");
}

main().catch(console.error);
