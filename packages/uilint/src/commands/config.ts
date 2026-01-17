/**
 * UILint Config Command
 *
 * Allows setting configuration options that are broadcast to connected clients.
 *
 * Usage:
 *   uilint config set position <x,y>     - Set floating icon position
 *   uilint config set position top-center - Use preset position
 *   uilint config get position            - Get current position (from server)
 */

import { WebSocket } from "ws";
import { logInfo, logSuccess, logError, pc } from "../utils/prompts.js";

export interface ConfigOptions {
  port?: number;
}

/** Parse position value from string */
function parsePosition(
  value: string
): { x: number; y: number } | { preset: string } | null {
  // Check for presets
  const presets: Record<string, true> = {
    "top-center": true,
    "top-left": true,
    "top-right": true,
    "bottom-center": true,
    "bottom-left": true,
    "bottom-right": true,
  };

  if (presets[value]) {
    return { preset: value };
  }

  // Try to parse as x,y coordinates
  const match = value.match(/^(\d+),(\d+)$/);
  if (match) {
    return { x: parseInt(match[1], 10), y: parseInt(match[2], 10) };
  }

  return null;
}

/** Convert preset to position (approximate, client will recalculate) */
function presetToPosition(preset: string): { x: number; y: number } {
  // These are approximate defaults - the client can recalculate based on viewport
  const positions: Record<string, { x: number; y: number }> = {
    "top-center": { x: 500, y: 30 },
    "top-left": { x: 60, y: 30 },
    "top-right": { x: 940, y: 30 },
    "bottom-center": { x: 500, y: 700 },
    "bottom-left": { x: 60, y: 700 },
    "bottom-right": { x: 940, y: 700 },
  };
  return positions[preset] || { x: 500, y: 30 };
}

/**
 * Send config message via WebSocket
 */
async function sendConfigMessage(
  port: number,
  key: string,
  value: unknown
): Promise<boolean> {
  return new Promise((resolve) => {
    const url = `ws://localhost:${port}`;
    const ws = new WebSocket(url);
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        ws.close();
        resolve(false);
      }
    }, 5000);

    ws.on("open", () => {
      const message = JSON.stringify({ type: "config:set", key, value });
      ws.send(message);

      // Give the server time to process and broadcast
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          ws.close();
          resolve(true);
        }
      }, 100);
    });

    ws.on("error", () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve(false);
      }
    });
  });
}

/**
 * Handle config set command
 */
async function handleSet(
  key: string,
  value: string,
  port: number
): Promise<void> {
  switch (key) {
    case "position": {
      const parsed = parsePosition(value);
      if (!parsed) {
        logError(
          `Invalid position value: ${value}\n` +
            `Expected format: x,y (e.g., 100,50) or preset (top-center, top-left, etc.)`
        );
        process.exit(1);
      }

      let position: { x: number; y: number };
      if ("preset" in parsed) {
        position = presetToPosition(parsed.preset);
        logInfo(`Using preset "${parsed.preset}" → (${position.x}, ${position.y})`);
      } else {
        position = parsed;
      }

      const success = await sendConfigMessage(
        port,
        "floatingIconPosition",
        position
      );

      if (success) {
        logSuccess(
          `Set floating icon position to (${position.x}, ${position.y})`
        );
      } else {
        logError(
          `Failed to set position. Is the server running?\n` +
            `Start it with: ${pc.bold("npx uilint serve")}`
        );
        process.exit(1);
      }
      break;
    }

    default:
      logError(`Unknown config key: ${key}`);
      logInfo(`Available keys: position`);
      process.exit(1);
  }
}

/**
 * Handle config get command
 */
async function handleGet(key: string, _port: number): Promise<void> {
  switch (key) {
    case "position":
      logInfo(
        `Position is stored in the browser's localStorage.\n` +
          `To view it, check your browser's dev tools:\n` +
          `  localStorage.getItem("uilint:floatingIconPosition")`
      );
      break;

    default:
      logError(`Unknown config key: ${key}`);
      logInfo(`Available keys: position`);
      process.exit(1);
  }
}

/**
 * Config command entry point
 */
export async function config(
  action: string,
  key: string,
  value?: string,
  options: ConfigOptions = {}
): Promise<void> {
  const port = options.port || 9234;

  switch (action) {
    case "set":
      if (!value) {
        logError(`Missing value for config set ${key}`);
        process.exit(1);
      }
      await handleSet(key, value, port);
      break;

    case "get":
      await handleGet(key, port);
      break;

    default:
      logError(`Unknown action: ${action}`);
      logInfo(`Usage: uilint config <set|get> <key> [value]`);
      process.exit(1);
  }
}
