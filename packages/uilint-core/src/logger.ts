/**
 * Shared logger for UILint packages
 * Outputs styled messages to stderr to avoid interfering with stdout
 */

import pc from "picocolors";

const PREFIX = pc.cyan("[uilint]");

// ============================================================================
// Test Environment Detection
// ============================================================================

/**
 * Check if we're running in a test environment.
 * Vitest sets VITEST=true when running tests.
 */
function isTestEnvironment(): boolean {
  return (
    typeof process !== "undefined" &&
    (process.env.VITEST === "true" || process.env.NODE_ENV === "test")
  );
}

// Cache the result since it won't change during runtime
const IS_TEST = isTestEnvironment();

// ============================================================================
// Test-Aware Logging (silent during tests)
// ============================================================================

/**
 * Log a message to the console (silent during tests).
 * Use this for development/debugging logs that shouldn't appear in test output.
 */
export function devLog(...args: unknown[]): void {
  if (!IS_TEST) {
    console.log(...args);
  }
}

/**
 * Log a warning to the console (silent during tests).
 * Use this for development warnings that shouldn't appear in test output.
 */
export function devWarn(...args: unknown[]): void {
  if (!IS_TEST) {
    console.warn(...args);
  }
}

/**
 * Log an error to the console (silent during tests).
 * Use this for development errors that shouldn't appear in test output.
 */
export function devError(...args: unknown[]): void {
  if (!IS_TEST) {
    console.error(...args);
  }
}

/**
 * Log an info message to stderr
 */
export function logInfo(message: string): void {
  console.error(`${PREFIX} ${pc.blue("ℹ")} ${message}`);
}

/**
 * Log a success message to stderr
 */
export function logSuccess(message: string): void {
  console.error(`${PREFIX} ${pc.green("✓")} ${message}`);
}

/**
 * Log a warning message to stderr
 */
export function logWarning(message: string): void {
  console.error(`${PREFIX} ${pc.yellow("⚠")} ${message}`);
}

/**
 * Log an error message to stderr
 */
export function logError(message: string): void {
  console.error(`${PREFIX} ${pc.red("✗")} ${message}`);
}

/**
 * Log a debug message to stderr (dimmed)
 */
export function logDebug(message: string): void {
  console.error(`${PREFIX} ${pc.dim(message)}`);
}

/**
 * Create a progress logger that updates the same line
 * Returns methods to update and finish the progress
 */
export function createProgress(initialMessage: string) {
  let lastLength = 0;

  const write = (message: string) => {
    // Clear the previous line if needed
    if (lastLength > 0) {
      process.stderr.write("\r" + " ".repeat(lastLength) + "\r");
    }
    const line = `${PREFIX} ${pc.magenta("⟳")} ${message}`;
    process.stderr.write(line);
    lastLength = line.length;
  };

  write(initialMessage);

  return {
    update: (message: string) => {
      write(message);
    },
    succeed: (message: string) => {
      if (lastLength > 0) {
        process.stderr.write("\r" + " ".repeat(lastLength) + "\r");
      }
      console.error(`${PREFIX} ${pc.green("✓")} ${message}`);
      lastLength = 0;
    },
    fail: (message: string) => {
      if (lastLength > 0) {
        process.stderr.write("\r" + " ".repeat(lastLength) + "\r");
      }
      console.error(`${PREFIX} ${pc.red("✗")} ${message}`);
      lastLength = 0;
    },
  };
}

// Re-export picocolors for consistent styling
export { pc };
