/**
 * Lightweight process-local profiling for UILint ESLint rules.
 *
 * The profiler is intentionally quiet during linting: visitor callbacks only
 * update in-memory aggregates, and summaries are flushed once at process exit.
 */

import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { isAbsolute, join, relative, resolve } from "path";

const DEFAULT_OUTLIER_LIMIT = 20;
const DEFAULT_MIN_OUTLIER_MS = 1;
const DEFAULT_PROFILE_DIR = ".uilint/profile";
const PROFILE_VERSION = 1;

const EXCLUDED_RULES = new Set([
  "semantic",
  "semantic-vision",
  "no-duplicates",
]);

export interface RuleProfilerOptions {
  enabled: boolean;
  profileDir: string;
  outlierLimit: number;
  minOutlierMs: number;
}

export interface RuleProfileListenerSummary {
  selector: string;
  totalMs: number;
  calls: number;
}

export interface RuleProfileSummary {
  ruleId: string;
  files: number;
  reports: number;
  setupMs: number;
  listenerMs: number;
  totalMs: number;
  listenerCalls: number;
  avgFileMs: number;
  p95FileMs: number;
  p99FileMs: number;
  maxFileMs: number;
  listeners: RuleProfileListenerSummary[];
}

export interface RuleProfileOutlier {
  ruleId: string;
  filePath: string;
  totalMs: number;
  setupMs: number;
  listenerMs: number;
  listenerCalls: number;
  reports: number;
}

export interface RuleProfileSession {
  version: number;
  generatedAt: string;
  durationMs: number;
  cwd: string;
  nodeVersion: string;
  fileCount: number;
  enabledRuleCount: number;
  rules: RuleProfileSummary[];
  outliers: RuleProfileOutlier[];
}

interface ListenerStats {
  totalNs: bigint;
  calls: number;
}

interface FileStats {
  setupNs: bigint;
  listenerNs: bigint;
  listenerCalls: number;
  reports: number;
}

interface RuleStats {
  files: Map<string, FileStats>;
  listeners: Map<string, ListenerStats>;
}

interface ProfilerState {
  startedAtNs: bigint;
  rules: Map<string, RuleStats>;
  flushRegistered: boolean;
  flushed: boolean;
  now: () => bigint;
}

let state: ProfilerState = createState();

function createState(): ProfilerState {
  return {
    startedAtNs: process.hrtime.bigint(),
    rules: new Map(),
    flushRegistered: false,
    flushed: false,
    now: () => process.hrtime.bigint(),
  };
}

function parseBoolean(value: string | undefined): boolean {
  if (value === undefined) return true;
  const normalized = value.trim().toLowerCase();
  return normalized !== "0" && normalized !== "false";
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number
): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeNumber(
  value: string | undefined,
  fallback: number
): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function getRuleProfilerOptions(): RuleProfilerOptions {
  const profileDir = process.env.UILINT_PROFILE_DIR || DEFAULT_PROFILE_DIR;
  return {
    enabled: parseBoolean(process.env.UILINT_PROFILE),
    profileDir: isAbsolute(profileDir) ? profileDir : resolve(process.cwd(), profileDir),
    outlierLimit: parsePositiveInteger(
      process.env.UILINT_PROFILE_OUTLIERS,
      DEFAULT_OUTLIER_LIMIT
    ),
    minOutlierMs: parseNonNegativeNumber(
      process.env.UILINT_PROFILE_MIN_MS,
      DEFAULT_MIN_OUTLIER_MS
    ),
  };
}

export function shouldProfileRule(ruleId: string): boolean {
  return getRuleProfilerOptions().enabled && !EXCLUDED_RULES.has(ruleId);
}

export function normalizeProfileFilePath(filePath: string): string {
  if (!filePath || filePath === "<input>" || filePath === "<text>") {
    return filePath || "<unknown>";
  }

  const absolute = isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath);
  const rel = relative(process.cwd(), absolute);
  return rel.startsWith("..") ? absolute : rel || ".";
}

function getRuleStats(ruleId: string): RuleStats {
  let stats = state.rules.get(ruleId);
  if (!stats) {
    stats = {
      files: new Map(),
      listeners: new Map(),
    };
    state.rules.set(ruleId, stats);
  }
  return stats;
}

function getFileStats(ruleId: string, filePath: string): FileStats {
  const ruleStats = getRuleStats(ruleId);
  const normalizedPath = normalizeProfileFilePath(filePath);
  let stats = ruleStats.files.get(normalizedPath);
  if (!stats) {
    stats = {
      setupNs: 0n,
      listenerNs: 0n,
      listenerCalls: 0,
      reports: 0,
    };
    ruleStats.files.set(normalizedPath, stats);
  }
  return stats;
}

function getListenerStats(ruleId: string, selector: string): ListenerStats {
  const ruleStats = getRuleStats(ruleId);
  let stats = ruleStats.listeners.get(selector);
  if (!stats) {
    stats = {
      totalNs: 0n,
      calls: 0,
    };
    ruleStats.listeners.set(selector, stats);
  }
  return stats;
}

export function recordRuleSetup(
  ruleId: string,
  filePath: string,
  durationNs: bigint
): void {
  if (durationNs < 0n) return;
  const stats = getFileStats(ruleId, filePath);
  stats.setupNs += durationNs;
}

export function recordRuleListener(
  ruleId: string,
  filePath: string,
  selector: string,
  durationNs: bigint
): void {
  if (durationNs < 0n) return;
  const fileStats = getFileStats(ruleId, filePath);
  fileStats.listenerNs += durationNs;
  fileStats.listenerCalls++;

  const listenerStats = getListenerStats(ruleId, selector);
  listenerStats.totalNs += durationNs;
  listenerStats.calls++;
}

export function recordRuleReport(ruleId: string, filePath: string): void {
  const stats = getFileStats(ruleId, filePath);
  stats.reports++;
}

function nsToMs(ns: bigint): number {
  return Number(ns) / 1_000_000;
}

function roundMs(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function percentile(sortedValues: number[], percentileValue: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((percentileValue / 100) * sortedValues.length) - 1;
  return sortedValues[Math.min(Math.max(index, 0), sortedValues.length - 1)];
}

export function buildRuleProfileSession(): RuleProfileSession {
  const options = getRuleProfilerOptions();
  const rules: RuleProfileSummary[] = [];
  const outliers: RuleProfileOutlier[] = [];
  const allFiles = new Set<string>();

  for (const [ruleId, ruleStats] of state.rules) {
    const fileTotals: number[] = [];
    let setupMs = 0;
    let listenerMs = 0;
    let reports = 0;
    let listenerCalls = 0;
    let maxFileMs = 0;

    for (const [filePath, fileStats] of ruleStats.files) {
      allFiles.add(filePath);

      const fileSetupMs = nsToMs(fileStats.setupNs);
      const fileListenerMs = nsToMs(fileStats.listenerNs);
      const fileTotalMs = fileSetupMs + fileListenerMs;

      setupMs += fileSetupMs;
      listenerMs += fileListenerMs;
      reports += fileStats.reports;
      listenerCalls += fileStats.listenerCalls;
      fileTotals.push(fileTotalMs);
      maxFileMs = Math.max(maxFileMs, fileTotalMs);

      if (fileTotalMs >= options.minOutlierMs) {
        outliers.push({
          ruleId,
          filePath,
          totalMs: roundMs(fileTotalMs),
          setupMs: roundMs(fileSetupMs),
          listenerMs: roundMs(fileListenerMs),
          listenerCalls: fileStats.listenerCalls,
          reports: fileStats.reports,
        });
      }
    }

    const sortedFileTotals = [...fileTotals].sort((a, b) => a - b);
    const totalMs = setupMs + listenerMs;
    const listeners = [...ruleStats.listeners.entries()]
      .map(([selector, listenerStats]) => ({
        selector,
        totalMs: roundMs(nsToMs(listenerStats.totalNs)),
        calls: listenerStats.calls,
      }))
      .sort((a, b) => b.totalMs - a.totalMs);

    rules.push({
      ruleId,
      files: ruleStats.files.size,
      reports,
      setupMs: roundMs(setupMs),
      listenerMs: roundMs(listenerMs),
      totalMs: roundMs(totalMs),
      listenerCalls,
      avgFileMs:
        ruleStats.files.size === 0
          ? 0
          : roundMs(totalMs / ruleStats.files.size),
      p95FileMs: roundMs(percentile(sortedFileTotals, 95)),
      p99FileMs: roundMs(percentile(sortedFileTotals, 99)),
      maxFileMs: roundMs(maxFileMs),
      listeners,
    });
  }

  rules.sort((a, b) => b.totalMs - a.totalMs);
  outliers.sort((a, b) => b.totalMs - a.totalMs);

  return {
    version: PROFILE_VERSION,
    generatedAt: new Date().toISOString(),
    durationMs: roundMs(nsToMs(state.now() - state.startedAtNs)),
    cwd: process.cwd(),
    nodeVersion: process.version,
    fileCount: allFiles.size,
    enabledRuleCount: rules.length,
    rules,
    outliers: outliers.slice(0, options.outlierLimit),
  };
}

function writeProfileSession(session: RuleProfileSession): void {
  const options = getRuleProfilerOptions();
  if (!options.enabled || session.rules.length === 0) return;

  if (!existsSync(options.profileDir)) {
    mkdirSync(options.profileDir, { recursive: true });
  }

  const json = `${JSON.stringify(session, null, 2)}\n`;
  writeFileSync(join(options.profileDir, "latest.json"), json, "utf-8");
  appendFileSync(
    join(options.profileDir, "sessions.jsonl"),
    `${JSON.stringify(session)}\n`,
    "utf-8"
  );
}

export function flushRuleProfiler(): RuleProfileSession | null {
  if (state.flushed) return null;
  state.flushed = true;

  const session = buildRuleProfileSession();
  writeProfileSession(session);
  return session;
}

export function registerRuleProfilerFlush(): void {
  if (state.flushRegistered) return;
  state.flushRegistered = true;

  process.once("beforeExit", () => {
    flushRuleProfiler();
  });
  process.once("exit", () => {
    flushRuleProfiler();
  });
}

export function resetRuleProfilerForTests(now?: () => bigint): void {
  state = createState();
  if (now) {
    state.now = now;
    state.startedAtNs = now();
  }
}

export function setRuleProfilerNowForTests(now: () => bigint): void {
  state.now = now;
}
