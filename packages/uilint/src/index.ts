/**
 * UILint CLI - AI-powered UI consistency checking
 */

import { Command } from "commander";
import { scan } from "./commands/scan.js";
import { analyze } from "./commands/analyze.js";
import { consistency } from "./commands/consistency.js";
import { update } from "./commands/update.js";
import { serve } from "./commands/serve.js";
import { vision } from "./commands/vision.js";
import { config } from "./commands/config.js";
import { createDuplicatesCommand } from "./commands/duplicates/index.js";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

function assertNodeVersion(minMajor: number, minMinor: number): void {
  const ver = process.versions.node || "";
  const parts = ver.split(".");
  const major = Number.parseInt(parts[0] || "", 10);
  const minor = Number.parseInt(parts[1] || "", 10);

  const meetsRequirement =
    Number.isFinite(major) &&
    Number.isFinite(minor) &&
    (major > minMajor || (major === minMajor && minor >= minMinor));

  if (!meetsRequirement) {
    // Keep this dependency-free and stdout/stderr friendly.
    // eslint-disable-next-line no-console
    console.error(
      `uilint requires Node.js >= ${minMajor}.${minMinor}.0. You are running Node.js ${ver}.`
    );
    process.exit(1);
  }
}

// Required by dependencies: chokidar, jsdom, readdirp, etc.
assertNodeVersion(20, 19);

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
  .action(async (options) => {
    const { installUI } = await import("./commands/install-ui.js");
    await installUI({ force: options.force });
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

// Config command
program
  .command("config")
  .description("Get or set UILint configuration options")
  .argument("<action>", "Action: set or get")
  .argument("<key>", "Config key (e.g., position, rule)")
  .argument("[value]", "Value to set (for set action)")
  .argument("[extraArg]", "Extra argument (e.g., options JSON for rule config)")
  .option("-p, --port <number>", "WebSocket server port", "9234")
  .action(async (action, key, value, extraArg, options) => {
    await config(action, key, value, extraArg, {
      port: parseInt(options.port, 10),
    });
  });

// Duplicates command group - semantic code duplicate detection
program.addCommand(createDuplicatesCommand());

// Upgrade command - update installed rules
program
  .command("upgrade")
  .description("Update installed ESLint rules to latest versions")
  .option("--check", "Show available updates without applying")
  .option("-y, --yes", "Auto-confirm all updates")
  .option("--dry-run", "Show what would change without modifying files")
  .option("--rule <id>", "Upgrade only a specific rule")
  .action(async (options) => {
    const { upgrade } = await import("./commands/upgrade.js");
    await upgrade({
      check: options.check,
      yes: options.yes,
      dryRun: options.dryRun,
      rule: options.rule,
    });
  });

program.parse();
