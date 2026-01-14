/**
 * UILint CLI - AI-powered UI consistency checking
 */

import { Command } from "commander";
import { scan } from "./commands/scan.js";
import { analyze } from "./commands/analyze.js";
import { consistency } from "./commands/consistency.js";
import { update } from "./commands/update.js";
import { install } from "./commands/install.js";
import { serve } from "./commands/serve.js";
import { vision } from "./commands/vision.js";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

function assertNodeVersion(minMajor: number): void {
  const ver = process.versions.node || "";
  const majorStr = ver.split(".")[0] || "";
  const major = Number.parseInt(majorStr, 10);

  if (!Number.isFinite(major) || major < minMajor) {
    // Keep this dependency-free and stdout/stderr friendly.
    // eslint-disable-next-line no-console
    console.error(
      `uilint requires Node.js >= ${minMajor}. You are running Node.js ${ver}.`
    );
    process.exit(1);
  }
}

assertNodeVersion(20);

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

// Analyze command
program
  .command("analyze")
  .description(
    "Analyze a source file/snippet for style issues (data-loc aware)"
  )
  .option("-f, --input-file <path>", "Path to a source file to analyze")
  .option("--source-code <code>", "Source code to analyze (string)")
  .option("--file-path <path>", "File path label shown in the prompt")
  .option("--style-guide <text>", "Inline styleguide content to use")
  .option("--styleguide-path <path>", "Path to a style guide file")
  .option("--component-name <name>", "Component name for focused analysis")
  .option("--component-line <n>", "Component line number (integer)", (v) =>
    parseInt(v, 10)
  )
  .option("--include-children", "Scope: selected element + children")
  .option(
    "--data-loc <value>",
    "data-loc value (repeatable) in format path:line:column",
    (v, prev: string[] | undefined) => (prev ? [...prev, v] : [v]),
    []
  )
  .option("-o, --output <format>", "Output format: text or json", "text")
  .option("--stream", "Stream progress while analyzing (text mode UI only)")
  .option("--debug", "Enable debug logging (stderr)")
  .option(
    "--debug-full",
    "Print full prompt/source/styleguide (can be very large)"
  )
  .option(
    "--debug-dump <path>",
    "Write full LLM payload dump to JSON file (or directory to auto-name)"
  )
  .action(async (options) => {
    await analyze({
      inputFile: options.inputFile,
      sourceCode: options.sourceCode,
      filePath: options.filePath,
      styleGuide: options.styleGuide,
      styleguidePath: options.styleguidePath,
      componentName: options.componentName,
      componentLine: options.componentLine,
      includeChildren: options.includeChildren,
      dataLoc: options.dataLoc,
      output: options.output,
      stream: options.stream,
      debug: options.debug,
      debugFull: options.debugFull,
      debugDump: options.debugDump,
    });
  });

// Scan command
program
  .command("scan")
  .description("Scan HTML for UI consistency issues")
  .option("-f, --input-file <path>", "Path to HTML file to scan")
  .option("-j, --input-json <json>", "JSON input with html and styles")
  .option("-s, --styleguide <path>", "Path to style guide file")
  .option("-o, --output <format>", "Output format: text or json", "text")
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
  .action(async (options) => {
    await consistency({
      inputJson: options.inputJson,
      output: options.output,
    });
  });

// Update command
program
  .command("update")
  .description("Update existing style guide with new styles")
  .option("-f, --input-file <path>", "Path to HTML file to analyze")
  .option("-j, --input-json <json>", "JSON input with html and styles")
  .option("-s, --styleguide <path>", "Path to style guide file")
  .option("--llm", "Use LLM to suggest updates")
  .action(async (options) => {
    await update({
      inputFile: options.inputFile,
      inputJson: options.inputJson,
      styleguide: options.styleguide,
      llm: options.llm,
    });
  });

// Install command
program
  .command("install")
  .description("Install UILint integration")
  .option("--force", "Overwrite existing configuration files")
  .option("--genstyleguide", "Install /genstyleguide Cursor command")
  .option("--eslint", "Install uilint-eslint plugin and configure ESLint")
  .option(
    "--routes",
    "Back-compat: install Next.js overlay (routes + deps + inject)"
  )
  .option(
    "--react",
    "Back-compat: install Next.js overlay (routes + deps + inject)"
  )
  .action(async (options) => {
    await install({
      force: options.force,
      genstyleguide: options.genstyleguide,
      eslint: options.eslint,
      routes: options.routes,
      react: options.react,
    });
  });

// Serve command - WebSocket server for UI overlay
program
  .command("serve")
  .description("Start WebSocket server for real-time UI linting")
  .option("-p, --port <number>", "Port to listen on", "9234")
  .action(async (options) => {
    await serve({
      port: parseInt(options.port, 10),
    });
  });

// Vision command
program
  .command("vision")
  .description("Analyze a screenshot with Ollama vision models (requires a manifest)")
  .option("--list", "List available .uilint/screenshots sidecars and exit")
  .option(
    "--screenshots-dir <path>",
    "Screenshots directory for --list (default: nearest .uilint/screenshots)"
  )
  .option("--image <path>", "Path to a screenshot image (png/jpg)")
  .option(
    "--sidecar <path>",
    "Path to a .uilint/screenshots/*.json sidecar (contains manifest + metadata)"
  )
  .option("--manifest-file <path>", "Path to a manifest JSON file (array)")
  .option("--manifest-json <json>", "Inline manifest JSON (array)")
  .option("--route <route>", "Optional route label (e.g., /todos)")
  .option(
    "-s, --styleguide <path>",
    "Path to style guide file OR project directory (falls back to upward search)"
  )
  .option("-o, --output <format>", "Output format: text or json", "text")
  .option("--model <name>", "Ollama vision model override", undefined)
  .option("--base-url <url>", "Ollama base URL (default: http://localhost:11434)")
  .option("--stream", "Stream model output/progress to stderr (text mode only)")
  .option("--debug", "Enable debug logging (stderr)")
  .option(
    "--debug-full",
    "Print full prompt/styleguide and include base64 in dumps (can be very large)"
  )
  .option(
    "--debug-dump <path>",
    "Write full analysis payload dump to JSON file (or directory to auto-name)"
  )
  .action(async (options) => {
    await vision({
      list: options.list,
      screenshotsDir: options.screenshotsDir,
      image: options.image,
      sidecar: options.sidecar,
      manifestFile: options.manifestFile,
      manifestJson: options.manifestJson,
      route: options.route,
      styleguide: options.styleguide,
      output: options.output,
      model: options.model,
      baseUrl: options.baseUrl,
      stream: options.stream,
      debug: options.debug,
      debugFull: options.debugFull,
      debugDump: options.debugDump,
    });
  });


program.parse();
