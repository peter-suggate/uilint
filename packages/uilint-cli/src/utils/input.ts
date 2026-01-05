/**
 * Input handling utilities for CLI
 */

import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { extname } from "path";
import {
  parseCLIInput,
  hasStdin,
  readStdin,
  type DOMSnapshot,
} from "uilint-core/node";
import { resolvePathSpecifier } from "./path-specifiers.js";

export interface InputOptions {
  inputFile?: string;
  inputJson?: string;
}

export type ScanInput =
  | {
      kind: "dom";
      snapshot: DOMSnapshot;
      source: "json" | "file" | "stdin";
      inputPath?: string;
    }
  | {
      kind: "source";
      source: string;
      inputPath: string;
      extension: string;
    };

function isHtmlLikeExtension(ext: string): boolean {
  return ext === ".html" || ext === ".htm";
}

function isJsonLikeExtension(ext: string): boolean {
  return ext === ".json";
}

/**
 * Gets input from various sources: stdin, file, or JSON string
 */
export async function getInput(options: InputOptions): Promise<DOMSnapshot> {
  // Priority: explicit JSON > explicit file > stdin
  if (options.inputJson) {
    return parseCLIInput(options.inputJson);
  }

  if (options.inputFile) {
    const filePath = resolvePathSpecifier(options.inputFile, process.cwd());
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${options.inputFile}`);
    }
    const content = await readFile(filePath, "utf-8");
    return parseCLIInput(content);
  }

  if (hasStdin()) {
    const content = await readStdin();
    if (!content.trim()) {
      throw new Error("No input provided via stdin");
    }
    return parseCLIInput(content);
  }

  throw new Error(
    "No input provided. Use --input-file, --input-json, or pipe content to stdin."
  );
}

/**
 * Gets scan input:
 * - If input is a file and it's not HTML/JSON, treat it as raw source (TSX/JSX/etc).
 * - Otherwise, treat it as HTML/DOM input (including JSON-wrapped snapshots).
 */
export async function getScanInput(options: InputOptions): Promise<ScanInput> {
  // Priority: explicit JSON > explicit file > stdin
  if (options.inputJson) {
    return {
      kind: "dom",
      snapshot: parseCLIInput(options.inputJson),
      source: "json",
    };
  }

  if (options.inputFile) {
    const filePath = resolvePathSpecifier(options.inputFile, process.cwd());
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${options.inputFile}`);
    }
    const content = await readFile(filePath, "utf-8");
    const ext = extname(filePath).toLowerCase();

    if (isHtmlLikeExtension(ext) || isJsonLikeExtension(ext)) {
      return {
        kind: "dom",
        snapshot: parseCLIInput(content),
        source: "file",
        inputPath: filePath,
      };
    }

    return {
      kind: "source",
      source: content,
      inputPath: filePath,
      extension: ext,
    };
  }

  if (hasStdin()) {
    const content = await readStdin();
    if (!content.trim()) {
      throw new Error("No input provided via stdin");
    }
    return {
      kind: "dom",
      snapshot: parseCLIInput(content),
      source: "stdin",
    };
  }

  throw new Error(
    "No input provided. Use --input-file, --input-json, or pipe content to stdin."
  );
}

/**
 * Gets code input from various sources
 */
export async function getCodeInput(options: {
  code?: string;
  file?: string;
}): Promise<string> {
  if (options.code) {
    return options.code;
  }

  if (options.file) {
    const filePath = resolvePathSpecifier(options.file, process.cwd());
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${options.file}`);
    }
    return readFile(filePath, "utf-8");
  }

  if (hasStdin()) {
    const content = await readStdin();
    if (!content.trim()) {
      throw new Error("No code provided via stdin");
    }
    return content;
  }

  throw new Error(
    "No code provided. Use --code, provide a file, or pipe to stdin."
  );
}

/**
 * Validates that a path exists
 */
export function validatePath(path: string, description: string): void {
  if (!existsSync(path)) {
    throw new Error(`${description} not found: ${path}`);
  }
}
