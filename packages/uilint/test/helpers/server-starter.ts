/**
 * Server starter helper for E2E testing
 *
 * Starts the UILint WebSocket server as a child process for testing.
 * Provides methods to wait for server ready and clean shutdown.
 */

import { spawn, ChildProcess } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ServerProcess {
  /** The child process */
  process: ChildProcess;
  /** The port the server is running on */
  port: number;
  /** Stop the server */
  stop(): Promise<void>;
  /** Get stdout output */
  getOutput(): string;
  /** Get stderr output */
  getErrors(): string;
}

export interface StartServerOptions {
  /** Port to run the server on (default: random available port) */
  port?: number;
  /** Working directory for the server */
  cwd: string;
  /** Timeout for server to become ready (default: 30000ms) */
  timeout?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Additional environment variables */
  env?: Record<string, string>;
}

/**
 * Get a random available port
 */
function getRandomPort(): number {
  // Use a port range unlikely to conflict with common services
  return Math.floor(Math.random() * (65535 - 49152) + 49152);
}

/**
 * Wait for the server to become ready by checking for the "running" message
 */
async function waitForReady(
  process: ChildProcess,
  output: string[],
  timeout: number,
  debug: boolean
): Promise<void> {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const checkInterval = setInterval(() => {
      // Check if process exited
      if (process.exitCode !== null) {
        clearInterval(checkInterval);
        reject(
          new Error(
            `Server exited with code ${process.exitCode}\n${output.join("")}`
          )
        );
        return;
      }

      // Check for ready message in output
      const allOutput = output.join("");
      if (allOutput.includes("WebSocket server running")) {
        clearInterval(checkInterval);
        if (debug) {
          console.log("[ServerStarter] Server ready");
        }
        resolve();
        return;
      }

      // Check timeout
      if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        reject(
          new Error(
            `Server did not become ready within ${timeout}ms\nOutput: ${allOutput}`
          )
        );
      }
    }, 100);
  });
}

/**
 * Start the UILint WebSocket server for testing
 */
export async function startServer(
  options: StartServerOptions
): Promise<ServerProcess> {
  const port = options.port || getRandomPort();
  const timeout = options.timeout || 30000;
  const debug = options.debug || false;

  // Path to the uilint CLI
  const cliPath = join(__dirname, "..", "..", "bin", "uilint.js");

  if (debug) {
    console.log(`[ServerStarter] Starting server on port ${port}`);
    console.log(`[ServerStarter] CLI path: ${cliPath}`);
    console.log(`[ServerStarter] Working dir: ${options.cwd}`);
  }

  const stdout: string[] = [];
  const stderr: string[] = [];

  const serverProcess = spawn("node", [cliPath, "serve", "--port", String(port)], {
    cwd: options.cwd,
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      // Skip coverage-related setup during tests
      UILINT_SKIP_COVERAGE_INSTALL: "1",
      UILINT_SKIP_COVERAGE_TESTS: "1",
      // Don't use color codes in output
      NO_COLOR: "1",
      FORCE_COLOR: "0",
      ...options.env,
    },
  });

  // Collect output
  serverProcess.stdout?.on("data", (data: Buffer) => {
    const text = data.toString();
    stdout.push(text);
    if (debug) {
      console.log(`[Server stdout] ${text.trim()}`);
    }
  });

  serverProcess.stderr?.on("data", (data: Buffer) => {
    const text = data.toString();
    stderr.push(text);
    if (debug) {
      console.log(`[Server stderr] ${text.trim()}`);
    }
  });

  // Wait for server to be ready
  try {
    await waitForReady(serverProcess, stdout, timeout, debug);
  } catch (error) {
    // Kill the process if it didn't start properly
    serverProcess.kill("SIGTERM");
    throw error;
  }

  return {
    process: serverProcess,
    port,
    getOutput: () => stdout.join(""),
    getErrors: () => stderr.join(""),
    stop: async () => {
      return new Promise((resolve) => {
        if (serverProcess.exitCode !== null) {
          resolve();
          return;
        }

        serverProcess.on("exit", () => {
          if (debug) {
            console.log("[ServerStarter] Server stopped");
          }
          resolve();
        });

        // Send SIGTERM for graceful shutdown
        serverProcess.kill("SIGTERM");

        // Force kill after timeout
        setTimeout(() => {
          if (serverProcess.exitCode === null) {
            if (debug) {
              console.log("[ServerStarter] Force killing server");
            }
            serverProcess.kill("SIGKILL");
          }
        }, 5000);
      });
    },
  };
}

/**
 * Check if a port is available
 */
export async function isPortAvailable(port: number): Promise<boolean> {
  const net = await import("net");
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  });
}

/**
 * Find an available port starting from the given port
 */
export async function findAvailablePort(startPort = 9300): Promise<number> {
  for (let port = startPort; port < startPort + 100; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available ports found starting from ${startPort}`);
}
