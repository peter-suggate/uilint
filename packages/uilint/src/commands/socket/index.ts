/**
 * Socket CLI Command
 *
 * Provides a CLI interface for interacting with the UILint socket server.
 * Useful for testing, debugging, and scripting.
 *
 * Usage:
 *   uilint socket                        # Start interactive REPL
 *   uilint socket lint:file <path>       # Lint a file
 *   uilint socket vision:check           # Check vision availability
 *   uilint socket listen                 # Listen for all messages
 */

import { Command } from "commander";
import { readFileSync, existsSync } from "fs";
import chalk from "chalk";
import { createSocketClient, SocketClient } from "./client.js";
import type { ServerMessage, ElementManifest } from "./types.js";

export interface SocketOptions {
  port: number;
  debug: boolean;
  json: boolean;
  timeout: number;
}

/**
 * Format a message for display
 */
function formatMessage(msg: ServerMessage, json: boolean): string {
  if (json) {
    return JSON.stringify(msg, null, 2);
  }

  switch (msg.type) {
    case "lint:result": {
      const lines = [`${chalk.cyan("lint:result")} ${msg.filePath}`];
      if (msg.issues.length === 0) {
        lines.push(chalk.green("  No issues found"));
      } else {
        for (const issue of msg.issues) {
          const loc = issue.column
            ? `${issue.line}:${issue.column}`
            : `${issue.line}`;
          const rule = issue.ruleId ? chalk.dim(` [${issue.ruleId}]`) : "";
          lines.push(`  ${chalk.yellow(loc)} ${issue.message}${rule}`);
        }
      }
      return lines.join("\n");
    }

    case "vision:status":
      if (msg.available) {
        return `${chalk.cyan("vision:status")} ${chalk.green("available")} (${msg.model})`;
      }
      return `${chalk.cyan("vision:status")} ${chalk.red("not available")}`;

    case "vision:result": {
      const lines = [
        `${chalk.cyan("vision:result")} ${msg.route} (${msg.analysisTime}ms)`,
      ];
      if (msg.error) {
        lines.push(chalk.red(`  Error: ${msg.error}`));
      } else if (msg.issues.length === 0) {
        lines.push(chalk.green("  No issues found"));
      } else {
        for (const issue of msg.issues) {
          const severity =
            issue.severity === "error"
              ? chalk.red("error")
              : issue.severity === "warning"
                ? chalk.yellow("warn")
                : chalk.blue("info");
          lines.push(`  ${severity} [${issue.category}] ${issue.message}`);
          if (issue.dataLoc) {
            lines.push(chalk.dim(`    at ${issue.dataLoc}`));
          }
        }
      }
      return lines.join("\n");
    }

    case "workspace:info":
      return `${chalk.cyan("workspace:info")}\n  appRoot: ${msg.appRoot}\n  workspaceRoot: ${msg.workspaceRoot}`;

    case "rules:metadata":
      return `${chalk.cyan("rules:metadata")} ${msg.rules.length} rules available`;

    case "source:result":
      return `${chalk.cyan("source:result")} ${msg.filePath} (${msg.totalLines} lines)`;

    case "source:error":
      return `${chalk.cyan("source:error")} ${msg.filePath}: ${chalk.red(msg.error)}`;

    case "coverage:result":
      return `${chalk.cyan("coverage:result")} Coverage data received`;

    case "coverage:error":
      return `${chalk.cyan("coverage:error")} ${chalk.red(msg.error)}`;

    case "rule:config:result":
      if (msg.success) {
        return `${chalk.cyan("rule:config:result")} ${msg.ruleId} -> ${msg.severity}`;
      }
      return `${chalk.cyan("rule:config:result")} ${msg.ruleId} ${chalk.red("failed")}: ${msg.error}`;

    case "duplicates:indexing:start":
      return `${chalk.cyan("duplicates:indexing:start")}`;

    case "duplicates:indexing:progress":
      return `${chalk.cyan("duplicates:indexing:progress")} ${msg.message}`;

    case "duplicates:indexing:complete":
      return `${chalk.cyan("duplicates:indexing:complete")} ${msg.totalChunks} chunks in ${msg.duration}ms`;

    case "duplicates:indexing:error":
      return `${chalk.cyan("duplicates:indexing:error")} ${chalk.red(msg.error)}`;

    case "file:changed":
      return `${chalk.cyan("file:changed")} ${msg.filePath}`;

    case "config:update":
      return `${chalk.cyan("config:update")} ${msg.key} = ${JSON.stringify(msg.value)}`;

    default:
      return `${chalk.cyan(msg.type)} ${JSON.stringify(msg)}`;
  }
}

/**
 * Run interactive REPL mode
 */
async function runRepl(client: SocketClient, options: SocketOptions): Promise<void> {
  const readline = await import("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.green("uilint> "),
  });

  console.log(chalk.bold("\nUILint Socket REPL"));
  console.log("Type 'help' for available commands, 'exit' to quit.\n");

  // Set up message handler
  client.onMessage((msg) => {
    console.log("\n" + formatMessage(msg, options.json));
    rl.prompt();
  });

  // Wait for initial messages
  try {
    await client.waitForWorkspaceInfo(2000);
  } catch {
    // Ignore timeout
  }

  rl.prompt();

  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      rl.prompt();
      return;
    }

    const [cmd, ...args] = trimmed.split(/\s+/);

    try {
      switch (cmd) {
        case "help":
          console.log(`
Available commands:
  lint:file <path>              Lint a file
  lint:element <path> <dataLoc> Lint a specific element
  vision:check                  Check if vision is available
  vision:analyze <route> <manifestFile> [screenshotFile]
                                Run vision analysis
  source:fetch <path>           Fetch source code
  coverage:request              Request coverage data
  rule:config <ruleId> <severity> [optionsJson]
                                Set rule configuration
  config:set <key> <value>      Set a config value
  subscribe <path>              Subscribe to file changes
  invalidate [path]             Invalidate cache
  messages                      Show queued messages
  clear                         Clear message queue
  json                          Toggle JSON output
  exit                          Exit REPL
`);
          break;

        case "lint:file":
          if (!args[0]) {
            console.log(chalk.red("Usage: lint:file <path>"));
          } else {
            const result = await client.lintFile(args[0], options.timeout);
            console.log(formatMessage(result, options.json));
          }
          break;

        case "lint:element":
          if (!args[0] || !args[1]) {
            console.log(chalk.red("Usage: lint:element <path> <dataLoc>"));
          } else {
            const result = await client.lintElement(args[0], args[1], options.timeout);
            console.log(formatMessage(result, options.json));
          }
          break;

        case "vision:check": {
          const result = await client.visionCheck(options.timeout);
          console.log(formatMessage(result, options.json));
          break;
        }

        case "vision:analyze":
          if (!args[0] || !args[1]) {
            console.log(chalk.red("Usage: vision:analyze <route> <manifestFile> [screenshotFile]"));
          } else {
            const manifestPath = args[1];
            if (!existsSync(manifestPath)) {
              console.log(chalk.red(`Manifest file not found: ${manifestPath}`));
            } else {
              const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as ElementManifest[];
              const params: {
                route: string;
                manifest: ElementManifest[];
                screenshotFile?: string;
                screenshot?: string;
              } = { route: args[0], manifest };

              if (args[2]) {
                if (existsSync(args[2])) {
                  // Read as base64
                  const imageBuffer = readFileSync(args[2]);
                  params.screenshot = imageBuffer.toString("base64");
                } else {
                  console.log(chalk.red(`Screenshot file not found: ${args[2]}`));
                  break;
                }
              }

              const result = await client.visionAnalyze(params, options.timeout);
              console.log(formatMessage(result, options.json));
            }
          }
          break;

        case "source:fetch":
          if (!args[0]) {
            console.log(chalk.red("Usage: source:fetch <path>"));
          } else {
            const result = await client.fetchSource(args[0], options.timeout);
            console.log(formatMessage(result, options.json));
          }
          break;

        case "coverage:request": {
          const result = await client.requestCoverage(options.timeout);
          console.log(formatMessage(result, options.json));
          break;
        }

        case "rule:config":
          if (!args[0] || !args[1]) {
            console.log(chalk.red("Usage: rule:config <ruleId> <severity> [optionsJson]"));
          } else {
            const severity = args[1] as "error" | "warn" | "off";
            const ruleOptions = args[2] ? JSON.parse(args[2]) : undefined;
            const result = await client.setRuleConfig(args[0], severity, ruleOptions, options.timeout);
            console.log(formatMessage(result, options.json));
          }
          break;

        case "config:set":
          if (!args[0] || !args[1]) {
            console.log(chalk.red("Usage: config:set <key> <value>"));
          } else {
            let value: unknown = args[1];
            try {
              value = JSON.parse(args[1]);
            } catch {
              // Keep as string
            }
            client.setConfig(args[0], value);
            console.log(chalk.green(`Set ${args[0]} = ${JSON.stringify(value)}`));
          }
          break;

        case "subscribe":
          if (!args[0]) {
            console.log(chalk.red("Usage: subscribe <path>"));
          } else {
            client.subscribeFile(args[0]);
            console.log(chalk.green(`Subscribed to ${args[0]}`));
          }
          break;

        case "invalidate":
          client.invalidateCache(args[0]);
          console.log(chalk.green(args[0] ? `Invalidated ${args[0]}` : "Invalidated all cache"));
          break;

        case "messages": {
          const msgs = client.getMessages();
          if (msgs.length === 0) {
            console.log(chalk.dim("No queued messages"));
          } else {
            for (const msg of msgs) {
              console.log(formatMessage(msg, options.json));
            }
          }
          break;
        }

        case "clear":
          client.clearMessages();
          console.log(chalk.green("Message queue cleared"));
          break;

        case "json":
          options.json = !options.json;
          console.log(chalk.green(`JSON output ${options.json ? "enabled" : "disabled"}`));
          break;

        case "exit":
        case "quit":
          client.disconnect();
          rl.close();
          process.exit(0);
          break;

        default:
          console.log(chalk.red(`Unknown command: ${cmd}. Type 'help' for available commands.`));
      }
    } catch (err) {
      console.log(chalk.red(`Error: ${(err as Error).message}`));
    }

    rl.prompt();
  });

  rl.on("close", () => {
    client.disconnect();
    process.exit(0);
  });
}

/**
 * Run listen mode (print all messages)
 */
async function runListen(
  client: SocketClient,
  options: SocketOptions,
  filter?: string
): Promise<void> {
  console.log(chalk.bold("\nListening for messages..."));
  if (filter) {
    console.log(chalk.dim(`Filter: ${filter}`));
  }
  console.log(chalk.dim("Press Ctrl+C to stop.\n"));

  client.onMessage((msg) => {
    if (filter && !msg.type.includes(filter.replace("*", ""))) {
      return;
    }
    console.log(formatMessage(msg, options.json));
  });

  // Keep running
  await new Promise(() => {});
}

/**
 * Create the socket command
 */
export function createSocketCommand(): Command {
  const cmd = new Command("socket")
    .description("Interact with the UILint socket server")
    .option("-p, --port <number>", "Socket server port", "9234")
    .option("-d, --debug", "Enable debug logging", false)
    .option("-j, --json", "Output JSON format", false)
    .option("-t, --timeout <ms>", "Request timeout in milliseconds", "30000");

  // Default action: start REPL
  cmd.action(async (cmdOptions) => {
    const options: SocketOptions = {
      port: parseInt(cmdOptions.port, 10),
      debug: cmdOptions.debug,
      json: cmdOptions.json,
      timeout: parseInt(cmdOptions.timeout, 10),
    };

    try {
      const client = await createSocketClient({ port: options.port, debug: options.debug });
      await runRepl(client, options);
    } catch (err) {
      console.error(chalk.red(`Failed to connect: ${(err as Error).message}`));
      console.error(chalk.dim(`Make sure the server is running: uilint serve -p ${options.port}`));
      process.exit(1);
    }
  });

  // listen subcommand
  cmd
    .command("listen")
    .description("Listen for all messages from the server")
    .option("-f, --filter <pattern>", "Filter messages by type pattern (e.g., lint:*, vision:*)")
    .action(async (subOptions, command) => {
      const parentOptions = command.parent?.opts() || {};
      const options: SocketOptions = {
        port: parseInt(parentOptions.port || "9234", 10),
        debug: parentOptions.debug || false,
        json: parentOptions.json || false,
        timeout: parseInt(parentOptions.timeout || "30000", 10),
      };

      try {
        const client = await createSocketClient({ port: options.port, debug: options.debug });
        await runListen(client, options, subOptions.filter);
      } catch (err) {
        console.error(chalk.red(`Failed to connect: ${(err as Error).message}`));
        process.exit(1);
      }
    });

  // lint:file subcommand
  cmd
    .command("lint:file <path>")
    .description("Lint a file and output results")
    .action(async (filePath, _subOptions, command) => {
      const parentOptions = command.parent?.opts() || {};
      const options: SocketOptions = {
        port: parseInt(parentOptions.port || "9234", 10),
        debug: parentOptions.debug || false,
        json: parentOptions.json || false,
        timeout: parseInt(parentOptions.timeout || "30000", 10),
      };

      try {
        const client = await createSocketClient({ port: options.port, debug: options.debug });
        await client.waitForWorkspaceInfo(2000).catch(() => {});
        const result = await client.lintFile(filePath, options.timeout);
        console.log(formatMessage(result, options.json));
        client.disconnect();
        process.exit(result.issues.length > 0 ? 1 : 0);
      } catch (err) {
        console.error(chalk.red(`Error: ${(err as Error).message}`));
        process.exit(1);
      }
    });

  // vision:check subcommand
  cmd
    .command("vision:check")
    .description("Check if vision analysis is available")
    .action(async (_subOptions, command) => {
      const parentOptions = command.parent?.opts() || {};
      const options: SocketOptions = {
        port: parseInt(parentOptions.port || "9234", 10),
        debug: parentOptions.debug || false,
        json: parentOptions.json || false,
        timeout: parseInt(parentOptions.timeout || "10000", 10),
      };

      try {
        const client = await createSocketClient({ port: options.port, debug: options.debug });
        const result = await client.visionCheck(options.timeout);
        console.log(formatMessage(result, options.json));
        client.disconnect();
        process.exit(result.available ? 0 : 1);
      } catch (err) {
        console.error(chalk.red(`Error: ${(err as Error).message}`));
        process.exit(1);
      }
    });

  // source:fetch subcommand
  cmd
    .command("source:fetch <path>")
    .description("Fetch source code for a file")
    .action(async (filePath, _subOptions, command) => {
      const parentOptions = command.parent?.opts() || {};
      const options: SocketOptions = {
        port: parseInt(parentOptions.port || "9234", 10),
        debug: parentOptions.debug || false,
        json: parentOptions.json || false,
        timeout: parseInt(parentOptions.timeout || "10000", 10),
      };

      try {
        const client = await createSocketClient({ port: options.port, debug: options.debug });
        await client.waitForWorkspaceInfo(2000).catch(() => {});
        const result = await client.fetchSource(filePath, options.timeout);
        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else if (result.type === "source:result") {
          console.log(result.content);
        } else {
          console.error(chalk.red(`Error: ${result.error}`));
        }
        client.disconnect();
        process.exit(result.type === "source:result" ? 0 : 1);
      } catch (err) {
        console.error(chalk.red(`Error: ${(err as Error).message}`));
        process.exit(1);
      }
    });

  // rules subcommand
  cmd
    .command("rules")
    .description("List available rules")
    .action(async (_subOptions, command) => {
      const parentOptions = command.parent?.opts() || {};
      const options: SocketOptions = {
        port: parseInt(parentOptions.port || "9234", 10),
        debug: parentOptions.debug || false,
        json: parentOptions.json || false,
        timeout: parseInt(parentOptions.timeout || "10000", 10),
      };

      try {
        const client = await createSocketClient({ port: options.port, debug: options.debug });
        const metadata = await client.waitForRulesMetadata(options.timeout);

        if (options.json) {
          console.log(JSON.stringify(metadata.rules, null, 2));
        } else {
          console.log(chalk.bold(`\n${metadata.rules.length} rules available:\n`));
          for (const rule of metadata.rules) {
            const severity =
              rule.currentSeverity === "error"
                ? chalk.red("error")
                : rule.currentSeverity === "warn"
                  ? chalk.yellow("warn")
                  : chalk.dim("off");
            console.log(`  ${chalk.cyan(rule.id)} [${severity}]`);
            console.log(chalk.dim(`    ${rule.description}`));
          }
        }

        client.disconnect();
      } catch (err) {
        console.error(chalk.red(`Error: ${(err as Error).message}`));
        process.exit(1);
      }
    });

  return cmd;
}

// Re-export types and client for programmatic use
export { SocketClient, createSocketClient } from "./client.js";
export { SocketTestHarness, createTestHarness } from "./test-harness.js";
export type * from "./types.js";
