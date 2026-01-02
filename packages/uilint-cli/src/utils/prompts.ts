/**
 * Shared clack/prompts utilities for UILint CLI
 * Provides branded intro/outro, spinners, and common UI patterns
 */

import * as p from "@clack/prompts";
import pc from "picocolors";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

/**
 * Get the CLI version from package.json
 */
function getCLIVersion(): string {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(__dirname, "..", "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
      version?: string;
    };
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/**
 * Branded UILint intro with logo and version
 */
export function intro(title?: string): void {
  const version = getCLIVersion();
  const header = pc.bold(pc.cyan("◆ UILint")) + pc.dim(` v${version}`);
  
  console.log();
  p.intro(title ? `${header} ${pc.dim("·")} ${title}` : header);
}

/**
 * Styled outro with next steps
 */
export function outro(message: string): void {
  p.outro(pc.green(message));
}

/**
 * Cancel message when user exits
 */
export function cancel(message = "Operation cancelled."): void {
  p.cancel(pc.yellow(message));
  process.exit(0);
}

/**
 * Check if user cancelled a prompt
 */
export function isCancel(value: unknown): value is symbol {
  return p.isCancel(value);
}

/**
 * Handle cancel check - exits if cancelled
 */
export function handleCancel<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    cancel();
    process.exit(0);
  }
  return value as T;
}

/**
 * Spinner wrapper with automatic error handling
 */
export async function withSpinner<T>(
  message: string,
  fn: () => Promise<T>
): Promise<T> {
  const s = p.spinner();
  s.start(message);
  try {
    const result = await fn();
    s.stop(pc.green("✓ ") + message);
    return result;
  } catch (error) {
    s.stop(pc.red("✗ ") + message);
    throw error;
  }
}

/**
 * Spinner that can be updated
 */
export function createSpinner() {
  return p.spinner();
}

/**
 * Display a note box
 */
export function note(message: string, title?: string): void {
  p.note(message, title);
}

/**
 * Display a log message
 */
export function log(message: string): void {
  p.log.message(message);
}

/**
 * Display an info message
 */
export function logInfo(message: string): void {
  p.log.info(message);
}

/**
 * Display a success message
 */
export function logSuccess(message: string): void {
  p.log.success(message);
}

/**
 * Display a warning message
 */
export function logWarning(message: string): void {
  p.log.warn(message);
}

/**
 * Display an error message
 */
export function logError(message: string): void {
  p.log.error(message);
}

/**
 * Display a step message
 */
export function logStep(message: string): void {
  p.log.step(message);
}

/**
 * Select prompt wrapper
 */
export async function select<T extends string>(options: {
  message: string;
  options: Array<{ value: T; label: string; hint?: string }>;
  initialValue?: T;
}): Promise<T> {
  const result = await p.select({
    message: options.message,
    options: options.options as { value: T; label: string; hint?: string }[],
    initialValue: options.initialValue,
  } as Parameters<typeof p.select>[0]);
  return handleCancel(result) as T;
}

/**
 * Confirm prompt wrapper
 */
export async function confirm(options: {
  message: string;
  initialValue?: boolean;
}): Promise<boolean> {
  const result = await p.confirm({
    message: options.message,
    initialValue: options.initialValue ?? true,
  });
  return handleCancel(result);
}

/**
 * Text input prompt wrapper
 */
export async function text(options: {
  message: string;
  placeholder?: string;
  defaultValue?: string;
  validate?: (value: string) => string | Error | undefined;
}): Promise<string> {
  const result = await p.text(options);
  return handleCancel(result);
}

/**
 * Multiselect prompt wrapper
 */
export async function multiselect<T extends string>(options: {
  message: string;
  options: Array<{ value: T; label: string; hint?: string }>;
  required?: boolean;
  initialValues?: T[];
}): Promise<T[]> {
  const result = await p.multiselect({
    message: options.message,
    options: options.options as { value: T; label: string; hint?: string }[],
    required: options.required,
    initialValues: options.initialValues,
  } as Parameters<typeof p.multiselect>[0]);
  return handleCancel(result) as T[];
}

/**
 * Group of tasks displayed together
 */
export async function group<T extends Record<string, unknown>>(
  prompts: p.PromptGroup<T>,
  options?: p.PromptGroupOptions<T>
): Promise<T> {
  const result = await p.group(prompts, options);
  return result;
}

// Re-export picocolors for consistent styling
export { pc };
