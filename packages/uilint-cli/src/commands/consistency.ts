/**
 * Consistency command - analyzes grouped DOM elements for visual inconsistencies
 */

import { createInterface } from "readline";
import {
  parseGroupedSnapshot,
  analyzeConsistency,
  formatConsistencyViolations,
  countElements,
  hasAnalyzableGroups,
  type ConsistencyResult,
} from "uilint-core";
import { ensureOllamaReady } from "uilint-core/node";
import {
  intro,
  withSpinner,
  logInfo,
  logError,
  logSuccess,
  logWarning,
  pc,
} from "../utils/prompts.js";
import { printJSON } from "../utils/output.js";

export interface ConsistencyOptions {
  inputJson?: string;
  output?: "text" | "json";
}

/**
 * Reads JSON input from stdin
 */
async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    const rl = createInterface({ input: process.stdin });
    rl.on("line", (line) => {
      data += line;
    });
    rl.on("close", () => {
      resolve(data);
    });
  });
}

/**
 * Main consistency analysis command
 */
export async function consistency(options: ConsistencyOptions): Promise<void> {
  const isJsonOutput = options.output === "json";

  if (!isJsonOutput) {
    intro("UI Consistency Analysis");
  }

  try {
    // Get input
    let inputJson = options.inputJson;
    if (!inputJson) {
      // Check if stdin has data
      if (!process.stdin.isTTY) {
        inputJson = await readStdin();
      }
    }

    if (!inputJson) {
      if (isJsonOutput) {
        printJSON({ error: "No input provided", violations: [] });
      } else {
        logError("No input provided. Use --input-json or pipe JSON to stdin.");
      }
      process.exit(1);
    }

    // Parse snapshot
    const snapshot = parseGroupedSnapshot(inputJson);
    if (!snapshot) {
      if (isJsonOutput) {
        printJSON({ error: "Invalid JSON input", violations: [] });
      } else {
        logError("Failed to parse input as GroupedSnapshot.");
      }
      process.exit(1);
    }

    const elementCount = countElements(snapshot);

    if (!isJsonOutput) {
      logInfo(`Analyzing ${pc.cyan(String(elementCount))} elements`);
    }

    // Check if there are analyzable groups
    if (!hasAnalyzableGroups(snapshot)) {
      const result: ConsistencyResult = {
        violations: [],
        elementCount,
        analysisTime: 0,
      };

      if (isJsonOutput) {
        printJSON(result);
      } else {
        logWarning("No groups with 2+ elements to analyze.");
      }
      return;
    }

    // Prepare Ollama
    if (!isJsonOutput) {
      await withSpinner("Preparing Ollama", async () => {
        await ensureOllamaReady();
      });
    } else {
      await ensureOllamaReady();
    }

    // Analyze with core function
    let result: ConsistencyResult;
    if (isJsonOutput) {
      result = await analyzeConsistency(snapshot, {});
    } else {
      result = await withSpinner("Analyzing with LLM", async () => {
        return await analyzeConsistency(snapshot, {});
      });
    }

    // Output results
    if (isJsonOutput) {
      printJSON(result);
    } else {
      console.log();
      console.log(formatConsistencyViolations(result.violations));

      if (result.violations.length > 0) {
        logInfo(
          `Analysis completed in ${pc.dim(String(result.analysisTime) + "ms")}`
        );
      } else {
        logSuccess(
          `Analysis completed in ${pc.dim(String(result.analysisTime) + "ms")}`
        );
      }
    }

    // Exit with error code if violations found
    if (result.violations.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    if (isJsonOutput) {
      printJSON({
        error: error instanceof Error ? error.message : "Unknown error",
        violations: [],
      });
    } else {
      logError(error instanceof Error ? error.message : "Analysis failed");
    }
    process.exit(1);
  }
}
