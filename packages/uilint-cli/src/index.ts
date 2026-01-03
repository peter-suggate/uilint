/**
 * UILint CLI - AI-powered UI consistency checking
 */

import { Command } from "commander";
import { UILINT_DEFAULT_OLLAMA_MODEL } from "uilint-core";
import { scan } from "./commands/scan.js";
import { consistency } from "./commands/consistency.js";
import { update } from "./commands/update.js";
import { install } from "./commands/install.js";
import {
  sessionClear,
  sessionTrack,
  sessionScan,
  sessionList,
} from "./commands/session.js";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const program = new Command();

function getCLIVersion(): string {
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

program
  .name("uilint")
  .description("AI-powered UI consistency checker")
  .version(getCLIVersion());

// Scan command
program
  .command("scan")
  .description("Scan HTML for UI consistency issues")
  .option("-f, --input-file <path>", "Path to HTML file to scan")
  .option("-j, --input-json <json>", "JSON input with html and styles")
  .option("-s, --styleguide <path>", "Path to style guide file")
  .option("-o, --output <format>", "Output format: text or json", "text")
  .option(
    "-m, --model <name>",
    "Ollama model to use",
    UILINT_DEFAULT_OLLAMA_MODEL
  )
  .option("--debug", "Enable debug logging (stderr)")
  .option(
    "--debug-full",
    "Print full prompt/style summary/styleguide (can be very large)"
  )
  .option(
    "--debug-dump <path>",
    "Write full LLM payload dump to JSON file (or directory to auto-name)"
  )
  .action(async (options) => {
    await scan({
      inputFile: options.inputFile,
      inputJson: options.inputJson,
      styleguide: options.styleguide,
      output: options.output,
      model: options.model,
      debug: options.debug,
      debugFull: options.debugFull,
      debugDump: options.debugDump,
    });
  });

// Consistency command
program
  .command("consistency")
  .description("Analyze grouped DOM elements for visual inconsistencies")
  .option("-j, --input-json <json>", "JSON input with GroupedSnapshot")
  .option("-o, --output <format>", "Output format: text or json", "text")
  .option(
    "-m, --model <name>",
    "Ollama model to use",
    UILINT_DEFAULT_OLLAMA_MODEL
  )
  .action(async (options) => {
    await consistency({
      inputJson: options.inputJson,
      output: options.output,
      model: options.model,
    });
  });

// Update command
program
  .command("update")
  .description("Update existing style guide with new styles")
  .option("-f, --input-file <path>", "Path to HTML file to analyze")
  .option("-j, --input-json <json>", "JSON input with html and styles")
  .option("-s, --styleguide <path>", "Path to style guide file")
  .option(
    "-m, --model <name>",
    "Ollama model to use",
    UILINT_DEFAULT_OLLAMA_MODEL
  )
  .option("--llm", "Use LLM to suggest updates")
  .action(async (options) => {
    await update({
      inputFile: options.inputFile,
      inputJson: options.inputJson,
      styleguide: options.styleguide,
      model: options.model,
      llm: options.llm,
    });
  });

// Install command
program
  .command("install")
  .description("Install UILint integration (MCP server and/or Cursor hooks)")
  .option("--force", "Overwrite existing configuration files")
  .option("--mcp", "Install MCP server integration (.cursor/mcp.json)")
  .option("--hooks", "Install Cursor hooks integration (.cursor/hooks.json)")
  .option("--genstyleguide", "Install /genstyleguide Cursor command")
  .option(
    "--routes",
    "Back-compat: install Next.js overlay (routes + deps + inject)"
  )
  .option(
    "--react",
    "Back-compat: install Next.js overlay (routes + deps + inject)"
  )
  .option(
    "-m, --model <name>",
    "Ollama model to use for installer LLM steps",
    UILINT_DEFAULT_OLLAMA_MODEL
  )
  .option(
    "--mode <mode>",
    "Integration mode: mcp, hooks, or both (skips interactive prompt)"
  )
  .action(async (options) => {
    await install({
      force: options.force,
      mode: options.mode,
      mcp: options.mcp,
      hooks: options.hooks,
      genstyleguide: options.genstyleguide,
      routes: options.routes,
      react: options.react,
      model: options.model,
    });
  });

// Session command (for Cursor hooks)
const sessionCmd = program
  .command("session")
  .description(
    "Manage file tracking for agentic sessions (used by Cursor hooks)"
  );

sessionCmd
  .command("clear")
  .description("Clear tracked files (called at start of agent turn)")
  .action(async () => {
    await sessionClear();
  });

sessionCmd
  .command("track <file>")
  .description("Track a file edit (called on each file edit)")
  .action(async (file: string) => {
    await sessionTrack(file);
  });

sessionCmd
  .command("scan")
  .description("Scan all tracked markup files (called on agent stop)")
  .option("--hook", "Output in Cursor hook format (followup_message JSON only)")
  .option(
    "-m, --model <name>",
    "Ollama model to use",
    UILINT_DEFAULT_OLLAMA_MODEL
  )
  .action(async (options: { hook?: boolean; model?: string }) => {
    await sessionScan({ hookFormat: options.hook, model: options.model });
  });

sessionCmd
  .command("list")
  .description("List tracked files (for debugging)")
  .action(async () => {
    await sessionList();
  });

program.parse();
