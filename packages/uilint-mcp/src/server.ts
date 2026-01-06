#!/usr/bin/env node

/**
 * UILint MCP Server
 *
 * This server delegates to the CLI for all scan operations,
 * providing a single source of truth for business logic.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { spawn } from "child_process";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { readFileSync, existsSync } from "fs";
import {
  formatViolationsText,
  sanitizeIssues,
  type UILintIssue,
} from "uilint-core";

/**
 * Result from running the CLI scan command
 */
interface CLIScanResult {
  issues: UILintIssue[];
  analysisTime?: number;
  elementCount?: number;
  error?: string;
}

/**
 * Resolves the path to the uilint CLI executable.
 * In the monorepo, we can use the sibling package directly.
 */
function resolveCLIPath(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  // In the monorepo: ../uilint-cli/dist/index.js
  const monorepoPath = join(
    __dirname,
    "..",
    "..",
    "uilint-cli",
    "dist",
    "index.js"
  );
  if (existsSync(monorepoPath)) {
    return monorepoPath;
  }

  // Fallback: run via `npx` so we don't depend on PATH having `uilint`.
  // NOTE: `runCLI` will inject `--yes uilint-cli ...` to keep it non-interactive.
  return "npx";
}

/**
 * Runs the CLI with the given arguments and returns the JSON result.
 */
async function runCLI(args: string[], cwd?: string): Promise<CLIScanResult> {
  const cliPath = resolveCLIPath();

  return new Promise((resolve, reject) => {
    const isDirectPath = cliPath.endsWith(".js");
    const isNPX = cliPath === "npx";
    const command = isDirectPath ? process.execPath : cliPath;
    const spawnArgs = isDirectPath
      ? [cliPath, ...args]
      : isNPX
      ? ["--yes", "uilint-cli", ...args]
      : args;

    const child = spawn(command, spawnArgs, {
      cwd: cwd || process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, FORCE_COLOR: "0" },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      // CLI exits with 1 when issues are found (not an error)
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch {
        if (code !== 0 && code !== 1) {
          reject(new Error(stderr || `CLI exited with code ${code}`));
        } else {
          reject(new Error(`Failed to parse CLI output: ${stdout}`));
        }
      }
    });

    child.on("error", (err) => {
      reject(err);
    });
  });
}

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

/**
 * Formats scan results for MCP response
 */
function formatScanResult(
  result: CLIScanResult,
  _context: string
): { content: Array<{ type: string; text: string }>; isError?: boolean } {
  if (result.error) {
    return {
      content: [{ type: "text", text: `Error: ${result.error}` }],
      isError: true,
    };
  }

  const issues = sanitizeIssues(result.issues || []);
  const text = formatViolationsText(issues, {
    includeFooter: issues.length > 0,
  });

  return {
    content: [
      {
        type: "text",
        text,
      },
    ],
  };
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
            projectPath: {
              type: "string",
              description:
                "Path to the project root (to find .uilint/styleguide.md)",
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
                "Path to the file to scan. Can be absolute or relative to projectPath.",
            },
            projectPath: {
              type: "string",
              description:
                "Path to the project root (to find .uilint/styleguide.md and resolve relative file paths)",
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
    const projectPath = (args?.projectPath as string) || process.cwd();

    switch (name) {
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

        const inputJson = JSON.stringify({ html: markup });

        const cliArgs = ["scan", "--input-json", inputJson, "--output", "json"];

        const result = await runCLI(cliArgs, projectPath);
        return formatScanResult(result, "");
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

        const absoluteFilePath = resolve(projectPath, filePath);

        const cliArgs = [
          "scan",
          "--input-file",
          absoluteFilePath,
          "--output",
          "json",
        ];

        const result = await runCLI(cliArgs, projectPath);
        return formatScanResult(result, filePath);
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
