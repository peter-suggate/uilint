/**
 * Static Mode Handler
 *
 * Processes manifest data and populates the ESLint store.
 * Used as an alternative to WebSocket communication for remote/production deployments.
 */

import type { PluginServices } from "../../core/plugin-system/types";
import type { ESLintPluginSlice } from "./slice";
import type { AvailableRule, RuleConfig } from "./types";
import type { Issue } from "../../ui/types";
import { createIssueId, parseDataLoc } from "../../ui/types";
import type {
  LintManifest,
  ManifestIssue,
  ManifestRuleMeta,
} from "../../core/services/manifest-types";
import {
  getManifestFetcher,
  configureManifestFetcher,
  type ManifestFetcher,
} from "../../core/services/manifest-fetcher";

/**
 * Convert manifest issue to unified Issue type
 */
function convertManifestIssue(issue: ManifestIssue, rules: ManifestRuleMeta[]): Issue {
  const { filePath } = parseDataLoc(issue.dataLoc);
  const ruleId = issue.ruleId || "unknown";

  // Look up severity from rule metadata
  const rule = rules.find(
    (r) => `uilint/${r.id}` === ruleId || r.id === ruleId
  );
  const severityStr = rule?.currentSeverity ?? rule?.defaultSeverity ?? "warn";
  const severity = severityStr === "error" ? "error" : "warning";

  return {
    id: createIssueId("eslint", ruleId, issue.dataLoc, issue.line),
    message: issue.message,
    severity,
    dataLoc: issue.dataLoc,
    ruleId,
    pluginId: "eslint",
    filePath,
    line: issue.line,
    column: issue.column,
  };
}

/**
 * Convert manifest rule metadata to AvailableRule format
 */
function convertRuleMetadata(rule: ManifestRuleMeta): AvailableRule {
  return {
    id: rule.id,
    name: rule.name,
    description: rule.description,
    category: rule.category,
    defaultSeverity: rule.defaultSeverity,
    currentSeverity: rule.currentSeverity,
    docs: rule.docs,
  };
}

/**
 * Process a fetched manifest and populate the store
 */
export function processManifest(
  services: PluginServices,
  manifest: LintManifest
): void {
  console.log(
    "[ESLint Plugin] Processing manifest:",
    manifest.summary.totalIssues,
    "issues in",
    manifest.summary.filesWithIssues,
    "files"
  );

  // Convert all issues and group by dataLoc
  const byDataLoc = new Map<string, Issue[]>();

  for (const file of manifest.files) {
    for (const rawIssue of file.issues) {
      const issue = convertManifestIssue(rawIssue, manifest.rules);
      const existing = byDataLoc.get(issue.dataLoc) || [];
      byDataLoc.set(issue.dataLoc, [...existing, issue]);
    }
  }

  // Convert rules to AvailableRule format
  const availableRules = manifest.rules.map(convertRuleMetadata);

  // Build rule configs
  const ruleConfigs = new Map<string, RuleConfig>();
  for (const rule of manifest.rules) {
    ruleConfigs.set(rule.id, {
      severity: rule.currentSeverity ?? rule.defaultSeverity,
    });
  }

  // Update store in a single batch
  services.setState({
    issues: byDataLoc,
    availableRules,
    ruleConfigs,
    workspaceRoot: manifest.workspaceRoot,
    scanStatus: "complete",
  });

  console.log(
    "[ESLint Plugin] Manifest processed:",
    byDataLoc.size,
    "unique dataLocs with issues"
  );
}

/**
 * Filter manifest issues to only those visible in the current DOM
 * (Optimization for large manifests)
 */
export function filterManifestByVisibleElements(
  manifest: LintManifest,
  visibleDataLocs: Set<string>
): ManifestIssue[] {
  const filtered: ManifestIssue[] = [];

  for (const file of manifest.files) {
    for (const issue of file.issues) {
      if (visibleDataLocs.has(issue.dataLoc)) {
        filtered.push(issue);
      }
    }
  }

  return filtered;
}

/**
 * Get source snippet for a dataLoc from the manifest
 */
export function getSourceSnippet(
  manifest: LintManifest,
  dataLoc: string
): { lines: string[]; startLine: number; endLine: number } | null {
  const { filePath } = parseDataLoc(dataLoc);

  // Find the file entry
  const fileEntry = manifest.files.find((f) => {
    // Handle both exact match and relative path variations
    return f.filePath === filePath || dataLoc.startsWith(f.filePath + ":");
  });

  if (!fileEntry?.snippets) {
    return null;
  }

  return fileEntry.snippets[dataLoc] ?? null;
}

/**
 * Static mode plugin state
 */
interface StaticModeState {
  mode: "static";
  manifestUrl: string;
  fetcher: ManifestFetcher;
  manifest: LintManifest | null;
}

let staticModeState: StaticModeState | null = null;

/**
 * Configure the ESLint plugin for static mode
 */
export function configureStaticMode(manifestUrl: string): void {
  const fetcher = configureManifestFetcher({ manifestUrl });
  staticModeState = {
    mode: "static",
    manifestUrl,
    fetcher,
    manifest: null,
  };
  console.log("[ESLint Plugin] Configured for static mode:", manifestUrl);
}

/**
 * Check if static mode is configured
 */
export function isStaticMode(): boolean {
  return staticModeState !== null;
}

/**
 * Get the static mode state
 */
export function getStaticModeState(): StaticModeState | null {
  return staticModeState;
}

/**
 * Clear static mode configuration
 */
export function clearStaticMode(): void {
  staticModeState = null;
}

/**
 * Initialize the ESLint plugin in static mode
 */
export function initializeStaticMode(services: PluginServices): () => void {
  if (!staticModeState) {
    console.error("[ESLint Plugin] Static mode not configured");
    return () => {};
  }

  const { fetcher } = staticModeState;

  console.log("[ESLint Plugin] Initializing in static mode...");

  // Set initial state
  services.setState({ scanStatus: "scanning" });

  // Fetch manifest
  fetcher
    .fetch()
    .then(({ manifest }) => {
      staticModeState!.manifest = manifest;
      processManifest(services, manifest);
    })
    .catch((error) => {
      console.error("[ESLint Plugin] Failed to fetch manifest:", error);
      services.setState({ scanStatus: "error" });
    });

  // In static mode, DOM observer just filters already-loaded issues
  // No need to send WebSocket requests
  const unsubscribeDom = services.domObserver.onElementsAdded((elements) => {
    if (!staticModeState?.manifest) return;

    // Log for debugging
    console.log(
      "[ESLint Plugin] Static mode: DOM elements detected:",
      elements.length
    );

    // No action needed - issues are already loaded from manifest
    // The HeatmapOverlay will match them by dataLoc
  });

  // Return cleanup function
  return () => {
    unsubscribeDom();
    console.log("[ESLint Plugin] Static mode disposed");
  };
}

/**
 * Get manifest metadata for display (e.g., in toolbar)
 */
export function getManifestMetadata(): {
  generatedAt: string;
  commitSha?: string;
  branch?: string;
  summary: LintManifest["summary"];
} | null {
  if (!staticModeState?.manifest) return null;

  const { manifest } = staticModeState;
  return {
    generatedAt: manifest.generatedAt,
    commitSha: manifest.commitSha,
    branch: manifest.branch,
    summary: manifest.summary,
  };
}
