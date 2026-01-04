/**
 * Consistency analysis logic - shared between CLI and API routes
 */

import type {
  GroupedSnapshot,
  Violation,
  ConsistencyResult,
  ViolationCategory,
  ViolationSeverity,
} from "./types.js";
import {
  buildConsistencyPrompt,
  countElements,
  hasAnalyzableGroups,
} from "./prompts.js";
import { OllamaClient } from "../ollama/client.js";

const VALID_CATEGORIES: ViolationCategory[] = [
  "spacing",
  "color",
  "typography",
  "sizing",
  "borders",
  "shadows",
];

const VALID_SEVERITIES: ViolationSeverity[] = ["error", "warning", "info"];

/**
 * Parses and validates a GroupedSnapshot from JSON string
 */
export function parseGroupedSnapshot(json: string): GroupedSnapshot | null {
  try {
    const parsed = JSON.parse(json);

    // Validate structure
    if (!parsed || typeof parsed !== "object") return null;

    const result: GroupedSnapshot = {
      buttons: Array.isArray(parsed.buttons) ? parsed.buttons : [],
      headings: Array.isArray(parsed.headings) ? parsed.headings : [],
      cards: Array.isArray(parsed.cards) ? parsed.cards : [],
      links: Array.isArray(parsed.links) ? parsed.links : [],
      inputs: Array.isArray(parsed.inputs) ? parsed.inputs : [],
      containers: Array.isArray(parsed.containers) ? parsed.containers : [],
    };

    return result;
  } catch {
    return null;
  }
}

/**
 * Parses violations from LLM response with defensive handling
 */
export function parseViolationsResponse(response: string): Violation[] {
  try {
    // Try direct JSON parse first
    const parsed = JSON.parse(response);
    if (Array.isArray(parsed.violations)) {
      return validateViolations(parsed.violations);
    }
    return [];
  } catch {
    // Try to extract JSON from response using regex
    const jsonMatch = response.match(/\{[\s\S]*"violations"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.violations)) {
          return validateViolations(parsed.violations);
        }
      } catch {
        // Fallback failed
      }
    }
    return [];
  }
}

/**
 * Validates and filters violations to ensure correct structure
 */
export function validateViolations(violations: unknown[]): Violation[] {
  return violations
    .filter((v): v is Violation => {
      if (!v || typeof v !== "object") return false;
      const obj = v as Record<string, unknown>;

      // Required fields
      if (!Array.isArray(obj.elementIds)) return false;
      if (typeof obj.category !== "string") return false;
      if (typeof obj.severity !== "string") return false;
      if (typeof obj.message !== "string") return false;
      if (!obj.details || typeof obj.details !== "object") return false;

      // Validate category
      if (!VALID_CATEGORIES.includes(obj.category as ViolationCategory))
        return false;

      // Validate severity
      if (!VALID_SEVERITIES.includes(obj.severity as ViolationSeverity))
        return false;

      return true;
    })
    .map((v) => ({
      elementIds: v.elementIds,
      category: v.category,
      severity: v.severity,
      message: v.message,
      details: {
        property:
          typeof v.details.property === "string" ? v.details.property : "",
        values: Array.isArray(v.details.values) ? v.details.values : [],
        suggestion:
          typeof v.details.suggestion === "string"
            ? v.details.suggestion
            : undefined,
      },
    }));
}

export interface AnalyzeConsistencyOptions {
  /** Ollama model to use */
  model?: string;
  /** Ollama base URL */
  baseUrl?: string;
}

/**
 * Analyzes a grouped snapshot for UI consistency violations
 * This is the main entry point for consistency analysis
 */
export async function analyzeConsistency(
  snapshot: GroupedSnapshot,
  options: AnalyzeConsistencyOptions = {}
): Promise<ConsistencyResult> {
  const startTime = Date.now();
  const elementCount = countElements(snapshot);

  // Check if there are analyzable groups
  if (!hasAnalyzableGroups(snapshot)) {
    return {
      violations: [],
      elementCount,
      analysisTime: Date.now() - startTime,
    };
  }

  // Build prompt and call LLM
  const prompt = buildConsistencyPrompt(snapshot);
  const client = new OllamaClient({
    model: options.model,
    baseUrl: options.baseUrl,
  });

  const response = await client.complete(prompt, { json: true });

  // Parse violations
  const violations = parseViolationsResponse(response);

  return {
    violations,
    elementCount,
    analysisTime: Date.now() - startTime,
  };
}

/**
 * Formats violations for plain text output
 */
export function formatConsistencyViolations(violations: Violation[]): string {
  if (violations.length === 0) {
    return "✓ No consistency issues found.";
  }

  const lines: string[] = [
    `Found ${violations.length} consistency issue(s):\n`,
  ];

  const severityIcons: Record<ViolationSeverity, string> = {
    error: "✖",
    warning: "⚠",
    info: "ℹ",
  };

  violations.forEach((v, i) => {
    const icon = severityIcons[v.severity] || "•";

    lines.push(`${i + 1}. ${icon} [${v.category}] ${v.message}`);
    lines.push(`   Elements: ${v.elementIds.join(", ")}`);

    if (v.details.property) {
      lines.push(`   Property: ${v.details.property}`);
    }
    if (v.details.values.length > 0) {
      lines.push(`   Values: ${v.details.values.join(" vs ")}`);
    }
    if (v.details.suggestion) {
      lines.push(`   Suggestion: ${v.details.suggestion}`);
    }
    lines.push("");
  });

  return lines.join("\n");
}
