/**
 * UILint CLI - AI-powered UI consistency checking
 */

import { Command } from "commander";
import { scan } from "./commands/scan.js";
import { init } from "./commands/init.js";
import { update } from "./commands/update.js";
import { validate } from "./commands/validate.js";
import { query } from "./commands/query.js";
import { install } from "./commands/install.js";
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
  .option("-m, --model <name>", "Ollama model to use", "qwen2.5-coder:7b")
  .action(async (options) => {
    await scan({
      inputFile: options.inputFile,
      inputJson: options.inputJson,
      styleguide: options.styleguide,
      output: options.output,
      model: options.model,
    });
  });

// Init command
program
  .command("init")
  .description("Create a style guide from detected styles")
  .option("-f, --input-file <path>", "Path to HTML file to analyze")
  .option("-j, --input-json <json>", "JSON input with html and styles")
  .option("-o, --output <path>", "Output path for style guide")
  .option("-m, --model <name>", "Ollama model to use", "qwen2.5-coder:7b")
  .option("--force", "Overwrite existing style guide")
  .option("--llm", "Use LLM to generate a more polished style guide")
  .action(async (options) => {
    await init({
      inputFile: options.inputFile,
      inputJson: options.inputJson,
      output: options.output,
      model: options.model,
      force: options.force,
      llm: options.llm,
    });
  });

// Update command
program
  .command("update")
  .description("Update existing style guide with new styles")
  .option("-f, --input-file <path>", "Path to HTML file to analyze")
  .option("-j, --input-json <json>", "JSON input with html and styles")
  .option("-s, --styleguide <path>", "Path to style guide file")
  .option("-m, --model <name>", "Ollama model to use", "qwen2.5-coder:7b")
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

// Validate command
program
  .command("validate")
  .description("Validate code against style guide")
  .option("-c, --code <code>", "Code snippet to validate")
  .option("-f, --file <path>", "Path to file to validate")
  .option("-s, --styleguide <path>", "Path to style guide file")
  .option("-o, --output <format>", "Output format: text or json", "text")
  .option("-m, --model <name>", "Ollama model to use", "qwen2.5-coder:7b")
  .option("--llm", "Use LLM for more thorough validation")
  .action(async (options) => {
    await validate({
      code: options.code,
      file: options.file,
      styleguide: options.styleguide,
      output: options.output,
      model: options.model,
      llm: options.llm,
    });
  });

// Query command
program
  .command("query <question>")
  .description("Query the style guide for specific rules")
  .option("-s, --styleguide <path>", "Path to style guide file")
  .option("-o, --output <format>", "Output format: text or json", "text")
  .option("-m, --model <name>", "Ollama model to use", "qwen2.5-coder:7b")
  .action(async (question, options) => {
    await query(question, {
      styleguide: options.styleguide,
      output: options.output,
      model: options.model,
    });
  });

// Install command
program
  .command("install")
  .description("Install Cursor rules for automatic UI validation")
  .option("--force", "Overwrite existing rules file")
  .action(async (options) => {
    await install({
      force: options.force,
    });
  });

program.parse();
