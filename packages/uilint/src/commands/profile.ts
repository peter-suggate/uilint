import { existsSync, readFileSync } from "fs";
import { isAbsolute, join, resolve } from "path";
import pc from "picocolors";

interface RuleProfileListenerSummary {
  selector: string;
  totalMs: number;
  calls: number;
}

interface RuleProfileSummary {
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

interface RuleProfileOutlier {
  ruleId: string;
  filePath: string;
  totalMs: number;
  setupMs: number;
  listenerMs: number;
  listenerCalls: number;
  reports: number;
}

interface RuleProfileSession {
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

export interface ProfileCommandOptions {
  profileDir?: string;
  json?: boolean;
  limit?: number;
}

function resolveProfileDir(profileDir?: string): string {
  const dir = profileDir || process.env.UILINT_PROFILE_DIR || ".uilint/profile";
  return isAbsolute(dir) ? dir : resolve(process.cwd(), dir);
}

function readLatestProfile(profileDir: string): RuleProfileSession {
  const latestPath = join(profileDir, "latest.json");
  if (!existsSync(latestPath)) {
    throw new Error(`No profile found at ${latestPath}`);
  }

  return JSON.parse(readFileSync(latestPath, "utf-8")) as RuleProfileSession;
}

function formatMs(value: number): string {
  return `${value.toFixed(value >= 10 ? 1 : 3)}ms`;
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : `${value}${" ".repeat(width - value.length)}`;
}

function printRuleTable(title: string, rules: RuleProfileSummary[]): void {
  console.log(pc.bold(title));
  if (rules.length === 0) {
    console.log(pc.dim("  No rule timings recorded."));
    return;
  }

  console.log(
    pc.dim(
      `  ${pad("rule", 34)} ${pad("total", 10)} ${pad("avg/file", 10)} ${pad("p95", 10)} ${pad("p99", 10)} ${pad("files", 7)} reports`
    )
  );

  for (const rule of rules) {
    console.log(
      `  ${pad(rule.ruleId, 34)} ${pad(formatMs(rule.totalMs), 10)} ${pad(formatMs(rule.avgFileMs), 10)} ${pad(formatMs(rule.p95FileMs), 10)} ${pad(formatMs(rule.p99FileMs), 10)} ${pad(String(rule.files), 7)} ${rule.reports}`
    );
  }
}

function printOutliers(outliers: RuleProfileOutlier[]): void {
  console.log(pc.bold("Top Outliers"));
  if (outliers.length === 0) {
    console.log(pc.dim("  No outliers met the configured threshold."));
    return;
  }

  console.log(
    pc.dim(
      `  ${pad("rule", 30)} ${pad("total", 10)} ${pad("listeners", 10)} file`
    )
  );

  for (const outlier of outliers) {
    console.log(
      `  ${pad(outlier.ruleId, 30)} ${pad(formatMs(outlier.totalMs), 10)} ${pad(String(outlier.listenerCalls), 10)} ${outlier.filePath}`
    );
  }
}

export async function profile(options: ProfileCommandOptions): Promise<void> {
  const profileDir = resolveProfileDir(options.profileDir);
  const session = readLatestProfile(profileDir);
  const limit = Math.max(1, options.limit ?? 10);

  if (options.json) {
    console.log(JSON.stringify(session, null, 2));
    return;
  }

  console.log(pc.bold("UILint Rule Profile"));
  console.log(`  Generated:       ${session.generatedAt}`);
  console.log(`  CWD:             ${session.cwd}`);
  console.log(`  Node:            ${session.nodeVersion}`);
  console.log(`  Duration:        ${formatMs(session.durationMs)}`);
  console.log(`  Files:           ${session.fileCount}`);
  console.log(`  Enabled rules:   ${session.enabledRuleCount}`);
  console.log(`  Profile source:  ${join(profileDir, "latest.json")}`);
  console.log();

  printRuleTable(
    "Slowest Rules By Total Time",
    [...session.rules].sort((a, b) => b.totalMs - a.totalMs).slice(0, limit)
  );
  console.log();
  printRuleTable(
    "Slowest Rules By Average File Time",
    [...session.rules]
      .sort((a, b) => b.avgFileMs - a.avgFileMs)
      .slice(0, limit)
  );
  console.log();
  printOutliers(session.outliers.slice(0, limit));
}
