#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { findStyleGuidePath, readStyleGuide } from "uilint-core/node";
import { validateCode } from "./tools/validate-code.js";
import { queryStyleGuide } from "./tools/query-styleguide.js";
import { lintSnippet } from "./tools/lint-snippet.js";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

function getServerVersion(): string {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(__dirname, "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version?: string };
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
        name: "validate_code",
        description:
          "Validate JSX/TSX UI code against the project style guide before applying changes. Returns issues if the code violates style guide rules.",
        inputSchema: {
          type: "object",
          properties: {
            code: {
              type: "string",
              description: "The JSX/TSX code to validate",
            },
            projectPath: {
              type: "string",
              description:
                "Path to the project root (to find .uilint/styleguide.md)",
            },
          },
          required: ["code"],
        },
      },
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
            projectPath: {
              type: "string",
              description:
                "Path to the project root (to find .uilint/styleguide.md)",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "lint_snippet",
        description:
          "Lint a UI code snippet and return any style consistency issues. Use this during code generation to check for problems.",
        inputSchema: {
          type: "object",
          properties: {
            code: {
              type: "string",
              description: "The code snippet to lint",
            },
            projectPath: {
              type: "string",
              description:
                "Path to the project root (to find .uilint/styleguide.md)",
            },
          },
          required: ["code"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Find and read the style guide
    const projectPath = (args?.projectPath as string) || process.cwd();
    const styleGuidePath = findStyleGuidePath(projectPath);
    const styleGuide = styleGuidePath
      ? await readStyleGuide(styleGuidePath)
      : null;

    switch (name) {
      case "validate_code": {
        const code = args?.code as string;
        if (!code) {
          return {
            content: [
              { type: "text", text: "Error: code parameter is required" },
            ],
            isError: true,
          };
        }
        const result = await validateCode(code, styleGuide);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      }

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

      case "lint_snippet": {
        const code = args?.code as string;
        if (!code) {
          return {
            content: [
              { type: "text", text: "Error: code parameter is required" },
            ],
            isError: true,
          };
        }
        const result = await lintSnippet(code, styleGuide);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
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
          text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
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
