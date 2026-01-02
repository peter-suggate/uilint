/**
 * Ollama bootstrapping utilities (Node.js only).
 *
 * Goals:
 * - Detect whether Ollama is installed.
 * - Ensure the Ollama daemon is running (best effort: start `ollama serve` detached).
 * - Ensure a given model is pulled (best effort: run `ollama pull <model>`).
 */

import { spawn, spawnSync } from "child_process";
import readline from "readline";
import { OllamaClient } from "./client.js";
import { UILINT_DEFAULT_OLLAMA_MODEL } from "./defaults.js";

const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isInteractiveTTY(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

async function promptYesNo(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return await new Promise<boolean>((resolve) => {
    rl.question(`${question} (y/N) `, (answer) => {
      rl.close();
      const normalized = (answer || "").trim().toLowerCase();
      resolve(normalized === "y" || normalized === "yes");
    });
  });
}

export function isOllamaInstalled(): boolean {
  const result = spawnSync("ollama", ["--version"], { stdio: "ignore" });
  if (
    result.error &&
    (result.error as NodeJS.ErrnoException).code === "ENOENT"
  ) {
    return false;
  }
  return result.status === 0;
}

function isBrewInstalled(): boolean {
  const result = spawnSync("brew", ["--version"], { stdio: "ignore" });
  if (
    result.error &&
    (result.error as NodeJS.ErrnoException).code === "ENOENT"
  ) {
    return false;
  }
  return result.status === 0;
}

function getInstallInstructions(): string[] {
  const lines: string[] = [
    "Ollama is required for LLM-backed analysis.",
    "",
    "Install Ollama:",
    "  - Download: https://ollama.ai",
  ];

  if (process.platform === "darwin") {
    lines.push("  - Homebrew: brew install ollama");
  }

  lines.push("");
  lines.push("Then start it:");
  lines.push("  ollama serve");
  return lines;
}

async function maybeInstallOllamaWithBrew(): Promise<boolean> {
  if (process.platform !== "darwin") return false;
  if (!isInteractiveTTY()) return false;

  if (!isBrewInstalled()) {
    // We can't auto-install without brew; leave instructions to the caller.
    return false;
  }

  const ok = await promptYesNo(
    "Ollama is not installed. Install with Homebrew now?"
  );
  if (!ok) return false;

  await new Promise<void>((resolve, reject) => {
    const child = spawn("brew", ["install", "ollama"], { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`brew install ollama failed (exit ${code})`));
    });
  });

  return isOllamaInstalled();
}

export async function ensureOllamaInstalledOrExplain(): Promise<void> {
  if (isOllamaInstalled()) return;

  const installedViaBrew = await maybeInstallOllamaWithBrew();
  if (installedViaBrew) return;

  const extra: string[] = [];
  if (process.platform === "darwin" && !isBrewInstalled()) {
    extra.push("");
    extra.push("Homebrew is not installed. Install it first, then run:");
    extra.push("  brew install ollama");
  }

  throw new Error([...getInstallInstructions(), ...extra].join("\n"));
}

export async function ensureOllamaRunning(options?: {
  timeoutMs?: number;
  baseUrl?: string;
}): Promise<void> {
  await ensureOllamaInstalledOrExplain();

  const baseUrl = options?.baseUrl || DEFAULT_OLLAMA_BASE_URL;
  const client = new OllamaClient({ baseUrl });
  const timeoutMs = options?.timeoutMs ?? 10_000;

  if (await client.isAvailable()) return;

  // Best-effort background start. We do not stop it later.
  try {
    const child = spawn("ollama", ["serve"], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
  } catch (err) {
    throw new Error(
      `Failed to start Ollama automatically.\n\n${getInstallInstructions().join(
        "\n"
      )}\n\nDetails: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await client.isAvailable()) return;
    await sleep(250);
  }

  throw new Error(
    [
      "Ollama did not become ready in time.",
      "",
      "Try starting it manually:",
      "  ollama serve",
    ].join("\n")
  );
}

async function fetchOllamaTags(baseUrl: string): Promise<string[]> {
  const res = await fetch(`${baseUrl}/api/tags`, {
    method: "GET",
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    throw new Error(`Ollama tags endpoint returned ${res.status}`);
  }

  const data = (await res.json()) as { models?: Array<{ name?: string }> };
  const names = (data.models ?? [])
    .map((m) => m.name)
    .filter((n): n is string => typeof n === "string");
  return names;
}

export async function ensureOllamaModelPulled(options?: {
  model?: string;
  baseUrl?: string;
}): Promise<void> {
  const desired = (options?.model || UILINT_DEFAULT_OLLAMA_MODEL).trim();
  if (!desired) return;

  const baseUrl = options?.baseUrl || DEFAULT_OLLAMA_BASE_URL;
  const tags = await fetchOllamaTags(baseUrl);
  if (tags.includes(desired)) return;

  await new Promise<void>((resolve, reject) => {
    const child = spawn("ollama", ["pull", desired], { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ollama pull ${desired} failed (exit ${code})`));
    });
  });

  const tagsAfter = await fetchOllamaTags(baseUrl);
  if (!tagsAfter.includes(desired)) {
    throw new Error(
      `Model ${desired} did not appear in Ollama tags after pulling.`
    );
  }
}

export async function ensureOllamaReady(options?: {
  model?: string;
  timeoutMs?: number;
  baseUrl?: string;
}): Promise<void> {
  await ensureOllamaRunning({
    timeoutMs: options?.timeoutMs,
    baseUrl: options?.baseUrl,
  });
  await ensureOllamaModelPulled({
    model: options?.model,
    baseUrl: options?.baseUrl,
  });
}
