/**
 * HTML parser for extracting styles using JSDOM
 * Used by CLI and Node.js environments
 */

import { JSDOM } from "jsdom";
import type { DOMSnapshot, SerializedStyles } from "../types.js";
import { extractStyles, deserializeStyles, truncateHTML } from "./style-extractor.js";

export interface ParseOptions {
  /**
   * If true, tries to load and process linked stylesheets
   */
  loadStylesheets?: boolean;
  /**
   * Max length for HTML in snapshot
   */
  maxHtmlLength?: number;
}

/**
 * Parses raw HTML and extracts styles using JSDOM
 */
export function parseHTML(
  html: string,
  options: ParseOptions = {}
): DOMSnapshot {
  const { maxHtmlLength = 50000 } = options;

  const dom = new JSDOM(html, {
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });

  const { document, getComputedStyle } = dom.window;
  const root = document.body || document.documentElement;

  const styles = extractStyles(root, getComputedStyle);
  const elementCount = root.querySelectorAll("*").length;

  return {
    html: truncateHTML(html, maxHtmlLength),
    styles,
    elementCount,
    timestamp: Date.now(),
  };
}

/**
 * Input format for CLI - can be raw HTML or pre-extracted JSON
 */
export interface CLIInput {
  html: string;
  styles?: SerializedStyles;
}

/**
 * Parses CLI input which can be either raw HTML or JSON with pre-extracted styles
 */
export function parseCLIInput(input: string): DOMSnapshot {
  // Try to parse as JSON first
  try {
    const parsed = JSON.parse(input) as CLIInput;
    
    if (parsed.html && parsed.styles) {
      // Pre-extracted styles from browser/test environment
      return {
        html: truncateHTML(parsed.html),
        styles: deserializeStyles(parsed.styles),
        elementCount: 0, // Not available for pre-extracted
        timestamp: Date.now(),
      };
    } else if (parsed.html) {
      // Just HTML in JSON format
      return parseHTML(parsed.html);
    }
  } catch {
    // Not JSON, treat as raw HTML
  }

  // Parse as raw HTML
  return parseHTML(input);
}

/**
 * Checks if a string looks like JSON
 */
export function isJSON(str: string): boolean {
  const trimmed = str.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

/**
 * Reads input from stdin
 */
export async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  
  return new Promise((resolve, reject) => {
    process.stdin.on("data", (chunk: Buffer | string) => {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    });
    process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    process.stdin.on("error", reject);
  });
}

/**
 * Detects if stdin has data
 */
export function hasStdin(): boolean {
  return !process.stdin.isTTY;
}

