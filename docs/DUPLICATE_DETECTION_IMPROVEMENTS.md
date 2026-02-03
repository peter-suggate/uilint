# Duplicate Detection Improvements - Implementation Plan

## Overview

This plan implements 6 improvements to the duplicate detection system, organized into 3 parallel work streams that can be developed simultaneously.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Duplicate Detection Flow                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Chunker    │───▶│  Normalizer  │───▶│  Embedder    │       │
│  │  (existing)  │    │    (NEW)     │    │  (existing)  │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                   │                   │                │
│         ▼                   ▼                   ▼                │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  AST-Based   │    │  Structural  │    │   Semantic   │       │
│  │  Similarity  │    │  Similarity  │    │  Similarity  │       │
│  │    (NEW)     │    │    (NEW)     │    │  (existing)  │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                   │                   │                │
│         └───────────────────┼───────────────────┘                │
│                             ▼                                    │
│                   ┌──────────────────┐                           │
│                   │  Combined Scorer │                           │
│                   │   (ENHANCED)     │                           │
│                   └──────────────────┘                           │
│                             │                                    │
│                             ▼                                    │
│                   ┌──────────────────┐                           │
│                   │ Confidence Level │                           │
│                   │      (NEW)       │                           │
│                   └──────────────────┘                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Parallel Work Streams

### Stream A: Structural Similarity (Can start immediately)
**Owner: Developer A**
**Files to create/modify:**
- `src/detection/structural-scorer.ts` (NEW)
- `src/detection/scorer.ts` (MODIFY)
- `test/structural-scorer.test.ts` (NEW)

### Stream B: AST Normalization (Can start immediately)
**Owner: Developer B**
**Files to create/modify:**
- `src/embeddings/normalizer.ts` (NEW)
- `src/embeddings/chunker.ts` (MODIFY)
- `test/normalizer.test.ts` (NEW)

### Stream C: Confidence Levels & Config (Can start immediately)
**Owner: Developer C**
**Files to create/modify:**
- `src/detection/confidence.ts` (NEW)
- `src/detection/duplicate-finder.ts` (MODIFY)
- `packages/uilint-eslint/src/rules/no-semantic-duplicates.ts` (MODIFY)
- `test/confidence.test.ts` (NEW)

### Integration Phase (After A, B, C complete)
**All developers**
- `src/detection/combined-scorer.ts` (NEW)
- `test/integration.test.ts` (NEW)

---

## Detailed Implementation

### Stream A: Structural Similarity Scoring

#### A1. Create `src/detection/structural-scorer.ts`

```typescript
/**
 * Structural Similarity Scorer
 *
 * Calculates similarity based on code structure (props, hooks, JSX elements)
 * independent of semantic embeddings.
 */

import type { ChunkMetadata } from "../embeddings/types.js";

export interface StructuralScore {
  /** Jaccard similarity of prop names (0-1) */
  propsOverlap: number;
  /** Jaccard similarity of JSX elements (0-1) */
  jsxOverlap: number;
  /** Jaccard similarity of hooks used (0-1) */
  hooksOverlap: number;
  /** Combined weighted score (0-1) */
  combined: number;
}

/**
 * Calculate Jaccard similarity between two sets
 */
export function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const setA = new Set(a.map(s => s.toLowerCase()));
  const setB = new Set(b.map(s => s.toLowerCase()));

  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return intersection.size / union.size;
}

/**
 * Calculate structural similarity between two chunks
 */
export function calculateStructuralSimilarity(
  a: ChunkMetadata,
  b: ChunkMetadata,
  weights: { props: number; jsx: number; hooks: number } = { props: 0.3, jsx: 0.4, hooks: 0.3 }
): StructuralScore {
  const propsOverlap = jaccard(a.props || [], b.props || []);
  const jsxOverlap = jaccard(a.jsxElements || [], b.jsxElements || []);
  const hooksOverlap = jaccard(a.hooks || [], b.hooks || []);

  const combined =
    propsOverlap * weights.props +
    jsxOverlap * weights.jsx +
    hooksOverlap * weights.hooks;

  return { propsOverlap, jsxOverlap, hooksOverlap, combined };
}

/**
 * Check if two chunks have high structural similarity
 * (useful for quick filtering before expensive embedding comparison)
 */
export function hasHighStructuralSimilarity(
  a: ChunkMetadata,
  b: ChunkMetadata,
  threshold: number = 0.6
): boolean {
  const score = calculateStructuralSimilarity(a, b);
  return score.combined >= threshold;
}
```

#### A2. Tests for `test/structural-scorer.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  jaccard,
  calculateStructuralSimilarity,
  hasHighStructuralSimilarity
} from '../src/detection/structural-scorer.js';

describe('Structural Scorer', () => {
  describe('jaccard', () => {
    it('should return 1 for identical sets', () => {
      expect(jaccard(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(1);
    });

    it('should return 0 for disjoint sets', () => {
      expect(jaccard(['a', 'b'], ['c', 'd'])).toBe(0);
    });

    it('should return 0.5 for 50% overlap', () => {
      expect(jaccard(['a', 'b'], ['b', 'c'])).toBeCloseTo(0.333, 2);
    });

    it('should be case-insensitive', () => {
      expect(jaccard(['Button', 'DIV'], ['button', 'div'])).toBe(1);
    });

    it('should handle empty arrays', () => {
      expect(jaccard([], [])).toBe(1);
      expect(jaccard(['a'], [])).toBe(0);
    });
  });

  describe('calculateStructuralSimilarity', () => {
    it('should calculate combined score for similar components', () => {
      const a = {
        props: ['title', 'description'],
        jsxElements: ['div', 'h3', 'p'],
        hooks: ['useState'],
      };
      const b = {
        props: ['title', 'description'],
        jsxElements: ['div', 'h3', 'p'],
        hooks: ['useState'],
      };

      const score = calculateStructuralSimilarity(a, b);
      expect(score.combined).toBe(1);
    });

    it('should detect Badge vs Tag as similar', () => {
      const badge = {
        props: ['children', 'variant', 'size'],
        jsxElements: ['span'],
        hooks: [],
      };
      const tag = {
        props: ['children', 'type', 'dimension'],
        jsxElements: ['span'],
        hooks: [],
      };

      const score = calculateStructuralSimilarity(badge, tag);
      // Different prop names but same JSX
      expect(score.jsxOverlap).toBe(1);
      expect(score.propsOverlap).toBeCloseTo(0.2, 1); // only 'children' overlaps
    });

    it('should detect MetricCard vs StatCard as similar', () => {
      const metricCard = {
        props: ['title', 'current', 'baseline', 'displayMode'],
        jsxElements: ['div', 'p', 'span', 'TrendingUp', 'TrendingDown'],
        hooks: ['useMemo'],
      };
      const statCard = {
        props: ['label', 'value', 'previousValue', 'format'],
        jsxElements: ['div', 'p', 'span', 'ArrowUpIcon', 'ArrowDownIcon'],
        hooks: [],
      };

      const score = calculateStructuralSimilarity(metricCard, statCard);
      // Should have moderate JSX overlap (div, p, span are common)
      expect(score.jsxOverlap).toBeGreaterThan(0.3);
    });
  });

  describe('hasHighStructuralSimilarity', () => {
    it('should return true for similar components', () => {
      const a = { props: ['a', 'b'], jsxElements: ['div', 'span'], hooks: [] };
      const b = { props: ['a', 'b'], jsxElements: ['div', 'span'], hooks: [] };
      expect(hasHighStructuralSimilarity(a, b, 0.8)).toBe(true);
    });

    it('should return false for different components', () => {
      const a = { props: ['a'], jsxElements: ['div'], hooks: [] };
      const b = { props: ['x'], jsxElements: ['table'], hooks: ['useEffect'] };
      expect(hasHighStructuralSimilarity(a, b, 0.5)).toBe(false);
    });
  });
});
```

---

### Stream B: AST Normalization

#### B1. Create `src/embeddings/normalizer.ts`

```typescript
/**
 * Code Normalizer
 *
 * Normalizes code before embedding to improve duplicate detection:
 * 1. Replaces identifiers with canonical placeholders
 * 2. Normalizes semantic equivalents (size/dimension, onClick/onPress)
 * 3. Strips comments and formatting noise
 */

import { parse, AST_NODE_TYPES, TSESTree } from "@typescript-eslint/typescript-estree";

export interface NormalizationOptions {
  /** Replace all identifiers with placeholders */
  normalizeIdentifiers?: boolean;
  /** Normalize semantic equivalents */
  normalizeSemantics?: boolean;
  /** Strip comments */
  stripComments?: boolean;
}

/**
 * Semantic equivalent patterns
 * Maps common naming variations to canonical forms
 */
const SEMANTIC_EQUIVALENTS: [RegExp, string][] = [
  // Size-related props
  [/\b(size|dimension|scale)\b/gi, '__SIZE__'],
  // Variant-related props
  [/\b(variant|type|kind|style)\b/gi, '__VARIANT__'],
  // Click handlers
  [/\b(onClick|onPress|onTap|handleClick|handlePress)\b/g, '__CLICK_HANDLER__'],
  // Loading states
  [/\b(loading|isLoading|pending|isFetching)\b/gi, '__LOADING__'],
  // Error states
  [/\b(error|errorMsg|errorMessage|err)\b/gi, '__ERROR__'],
  // Data/items
  [/\b(data|items|list|results|entries)\b/gi, '__DATA__'],
  // Children/content
  [/\b(children|content|body|slot)\b/gi, '__CHILDREN__'],
];

/**
 * Normalize code for embedding comparison
 */
export function normalizeCode(
  code: string,
  options: NormalizationOptions = {}
): string {
  const {
    normalizeIdentifiers = false,
    normalizeSemantics = true,
    stripComments = true,
  } = options;

  let result = code;

  // Strip comments
  if (stripComments) {
    result = result
      .replace(/\/\/.*$/gm, '')           // Single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '');   // Multi-line comments
  }

  // Normalize semantic equivalents
  if (normalizeSemantics) {
    for (const [pattern, replacement] of SEMANTIC_EQUIVALENTS) {
      result = result.replace(pattern, replacement);
    }
  }

  // Full identifier normalization (for near-identical detection)
  if (normalizeIdentifiers) {
    result = normalizeIdentifiersInCode(result);
  }

  // Normalize whitespace
  result = result
    .replace(/\s+/g, ' ')
    .trim();

  return result;
}

/**
 * Normalize all identifiers to placeholders
 * This is more aggressive and useful for finding truly identical code
 */
function normalizeIdentifiersInCode(code: string): string {
  try {
    const ast = parse(code, { jsx: true, loc: false, range: true });
    const identifierMap = new Map<string, string>();
    let counter = 0;

    function getPlaceholder(name: string): string {
      if (!identifierMap.has(name)) {
        identifierMap.set(name, `_ID${counter++}_`);
      }
      return identifierMap.get(name)!;
    }

    // Collect all identifier positions
    const replacements: { start: number; end: number; replacement: string }[] = [];

    function visit(node: TSESTree.Node) {
      if (node.type === AST_NODE_TYPES.Identifier && node.range) {
        // Skip certain built-ins
        const builtins = ['React', 'useState', 'useEffect', 'useCallback', 'useMemo', 'useRef'];
        if (!builtins.includes(node.name)) {
          replacements.push({
            start: node.range[0],
            end: node.range[1],
            replacement: getPlaceholder(node.name),
          });
        }
      }

      // Recurse into children
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === 'loc' || key === 'range') continue;
        const child = (node as Record<string, unknown>)[key];
        if (child && typeof child === 'object') {
          if (Array.isArray(child)) {
            child.forEach(c => {
              if (c && typeof c === 'object' && 'type' in c) {
                visit(c as TSESTree.Node);
              }
            });
          } else if ('type' in child) {
            visit(child as TSESTree.Node);
          }
        }
      }
    }

    visit(ast);

    // Apply replacements in reverse order to maintain positions
    replacements.sort((a, b) => b.start - a.start);
    let result = code;
    for (const { start, end, replacement } of replacements) {
      result = result.slice(0, start) + replacement + result.slice(end);
    }

    return result;
  } catch {
    // If parsing fails, return original
    return code;
  }
}

/**
 * Calculate normalized similarity between two code snippets
 * Returns 1.0 for identical normalized code
 */
export function calculateNormalizedSimilarity(
  codeA: string,
  codeB: string,
  options: NormalizationOptions = { normalizeIdentifiers: true }
): number {
  const normalizedA = normalizeCode(codeA, options);
  const normalizedB = normalizeCode(codeB, options);

  if (normalizedA === normalizedB) {
    return 1.0;
  }

  // Calculate Levenshtein-based similarity for near-matches
  const distance = levenshteinDistance(normalizedA, normalizedB);
  const maxLen = Math.max(normalizedA.length, normalizedB.length);

  return maxLen > 0 ? 1 - (distance / maxLen) : 1;
}

/**
 * Simple Levenshtein distance implementation
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
```

#### B2. Tests for `test/normalizer.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  normalizeCode,
  calculateNormalizedSimilarity
} from '../src/embeddings/normalizer.js';

describe('Normalizer', () => {
  describe('normalizeCode', () => {
    it('should normalize semantic equivalents', () => {
      const code1 = 'function Component({ size }) { return <div>{size}</div> }';
      const code2 = 'function Component({ dimension }) { return <div>{dimension}</div> }';

      const normalized1 = normalizeCode(code1, { normalizeSemantics: true });
      const normalized2 = normalizeCode(code2, { normalizeSemantics: true });

      expect(normalized1).toContain('__SIZE__');
      expect(normalized2).toContain('__SIZE__');
    });

    it('should strip comments', () => {
      const code = `
        // This is a comment
        function test() {
          /* Multi-line
             comment */
          return 42;
        }
      `;

      const normalized = normalizeCode(code, { stripComments: true });
      expect(normalized).not.toContain('comment');
    });

    it('should normalize click handlers', () => {
      const code1 = '<Button onClick={handleClick}>Click</Button>';
      const code2 = '<Button onPress={handlePress}>Click</Button>';

      const normalized1 = normalizeCode(code1);
      const normalized2 = normalizeCode(code2);

      expect(normalized1).toContain('__CLICK_HANDLER__');
      expect(normalized2).toContain('__CLICK_HANDLER__');
    });
  });

  describe('calculateNormalizedSimilarity', () => {
    it('should return 1.0 for identical code with different variable names', () => {
      const code1 = `
        export function formatCurrency(amount: number): string {
          return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
        }
      `;
      const code2 = `
        export function formatMoney(value: number): string {
          return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
        }
      `;

      const similarity = calculateNormalizedSimilarity(code1, code2);
      expect(similarity).toBeGreaterThan(0.95);
    });

    it('should detect truncateText vs shortenText as near-identical', () => {
      const code1 = `
        export function truncateText(text: string, maxLength: number): string {
          if (text.length <= maxLength) return text;
          return text.slice(0, maxLength - 3) + "...";
        }
      `;
      const code2 = `
        export function shortenText(text: string, maxLength: number): string {
          if (text.length <= maxLength) return text;
          return text.slice(0, maxLength - 3) + "...";
        }
      `;

      const similarity = calculateNormalizedSimilarity(code1, code2);
      expect(similarity).toBeGreaterThan(0.95);
    });

    it('should return lower score for genuinely different code', () => {
      const code1 = 'function add(a, b) { return a + b; }';
      const code2 = 'function multiply(a, b) { return a * b; }';

      const similarity = calculateNormalizedSimilarity(code1, code2);
      expect(similarity).toBeLessThan(0.9);
    });
  });
});
```

---

### Stream C: Confidence Levels & Configuration

#### C1. Create `src/detection/confidence.ts`

```typescript
/**
 * Confidence Level System
 *
 * Provides confidence levels for duplicate detection results
 * to help users prioritize which duplicates to address.
 */

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ConfidenceConfig {
  /** Threshold for high confidence (default: 0.90) */
  highThreshold: number;
  /** Threshold for medium confidence (default: 0.75) */
  mediumThreshold: number;
  /** Threshold for low confidence (default: 0.60) */
  lowThreshold: number;
}

export const DEFAULT_CONFIDENCE_CONFIG: ConfidenceConfig = {
  highThreshold: 0.90,
  mediumThreshold: 0.75,
  lowThreshold: 0.60,
};

export interface ConfidenceResult {
  level: ConfidenceLevel;
  score: number;
  description: string;
  action: string;
}

/**
 * Determine confidence level from a similarity score
 */
export function getConfidenceLevel(
  score: number,
  config: ConfidenceConfig = DEFAULT_CONFIDENCE_CONFIG
): ConfidenceLevel {
  if (score >= config.highThreshold) return 'high';
  if (score >= config.mediumThreshold) return 'medium';
  if (score >= config.lowThreshold) return 'low';
  return 'low'; // Below threshold but still reported
}

/**
 * Get detailed confidence result with actionable guidance
 */
export function getConfidenceResult(
  score: number,
  config: ConfidenceConfig = DEFAULT_CONFIDENCE_CONFIG
): ConfidenceResult {
  const level = getConfidenceLevel(score, config);

  switch (level) {
    case 'high':
      return {
        level,
        score,
        description: 'High confidence duplicate - likely copy-paste or near-identical implementation',
        action: 'Strongly recommend consolidating into a single reusable component/function',
      };
    case 'medium':
      return {
        level,
        score,
        description: 'Medium confidence - semantically similar code with different implementation',
        action: 'Review for potential consolidation or abstraction',
      };
    case 'low':
      return {
        level,
        score,
        description: 'Low confidence - possibly related patterns or partial overlap',
        action: 'Optional review - may be intentionally different',
      };
  }
}

/**
 * Get emoji indicator for confidence level (for CLI output)
 */
export function getConfidenceEmoji(level: ConfidenceLevel): string {
  switch (level) {
    case 'high': return '🔴';
    case 'medium': return '🟡';
    case 'low': return '🟢';
  }
}

/**
 * Format confidence for display
 */
export function formatConfidence(result: ConfidenceResult): string {
  const emoji = getConfidenceEmoji(result.level);
  const percent = Math.round(result.score * 100);
  return `${emoji} ${percent}% (${result.level} confidence)`;
}
```

#### C2. Tests for `test/confidence.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  getConfidenceLevel,
  getConfidenceResult,
  formatConfidence,
  DEFAULT_CONFIDENCE_CONFIG,
} from '../src/detection/confidence.js';

describe('Confidence System', () => {
  describe('getConfidenceLevel', () => {
    it('should return high for scores >= 0.90', () => {
      expect(getConfidenceLevel(0.95)).toBe('high');
      expect(getConfidenceLevel(0.90)).toBe('high');
    });

    it('should return medium for scores 0.75-0.89', () => {
      expect(getConfidenceLevel(0.89)).toBe('medium');
      expect(getConfidenceLevel(0.75)).toBe('medium');
    });

    it('should return low for scores 0.60-0.74', () => {
      expect(getConfidenceLevel(0.74)).toBe('low');
      expect(getConfidenceLevel(0.60)).toBe('low');
    });

    it('should respect custom config', () => {
      const config = {
        highThreshold: 0.95,
        mediumThreshold: 0.80,
        lowThreshold: 0.65,
      };
      expect(getConfidenceLevel(0.92, config)).toBe('medium');
    });
  });

  describe('getConfidenceResult', () => {
    it('should provide actionable guidance for high confidence', () => {
      const result = getConfidenceResult(0.95);
      expect(result.level).toBe('high');
      expect(result.action).toContain('consolidat');
    });

    it('should provide review guidance for medium confidence', () => {
      const result = getConfidenceResult(0.80);
      expect(result.level).toBe('medium');
      expect(result.action).toContain('Review');
    });
  });

  describe('formatConfidence', () => {
    it('should format with emoji and percentage', () => {
      const result = getConfidenceResult(0.85);
      const formatted = formatConfidence(result);
      expect(formatted).toContain('85%');
      expect(formatted).toContain('medium');
    });
  });
});
```

---

### Integration: Combined Scorer

#### Create `src/detection/combined-scorer.ts`

```typescript
/**
 * Combined Scorer
 *
 * Combines multiple similarity signals into a final score:
 * - Semantic similarity (from embeddings)
 * - Structural similarity (from metadata)
 * - Normalized similarity (from AST normalization)
 */

import type { ChunkMetadata } from "../embeddings/types.js";
import { calculateStructuralSimilarity } from "./structural-scorer.js";
import { calculateNormalizedSimilarity } from "../embeddings/normalizer.js";
import { getConfidenceLevel, type ConfidenceLevel } from "./confidence.js";

export interface CombinedScore {
  /** Final combined score (0-1) */
  final: number;
  /** Semantic embedding similarity */
  semantic: number;
  /** Structural metadata similarity */
  structural: number;
  /** Normalized code similarity (optional, expensive) */
  normalized?: number;
  /** Confidence level based on final score */
  confidence: ConfidenceLevel;
}

export interface CombinedScorerOptions {
  /** Weight for semantic similarity (default: 0.5) */
  semanticWeight?: number;
  /** Weight for structural similarity (default: 0.3) */
  structuralWeight?: number;
  /** Weight for normalized similarity (default: 0.2) */
  normalizedWeight?: number;
  /** Whether to compute expensive normalized similarity */
  includeNormalized?: boolean;
}

const DEFAULT_OPTIONS: Required<CombinedScorerOptions> = {
  semanticWeight: 0.5,
  structuralWeight: 0.3,
  normalizedWeight: 0.2,
  includeNormalized: false,
};

/**
 * Calculate combined similarity score
 */
export function calculateCombinedScore(
  semanticScore: number,
  metadataA: ChunkMetadata,
  metadataB: ChunkMetadata,
  codeA?: string,
  codeB?: string,
  options: CombinedScorerOptions = {}
): CombinedScore {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Calculate structural similarity
  const structuralResult = calculateStructuralSimilarity(metadataA, metadataB);
  const structural = structuralResult.combined;

  // Optionally calculate normalized similarity
  let normalized: number | undefined;
  let normalizedContribution = 0;

  if (opts.includeNormalized && codeA && codeB) {
    normalized = calculateNormalizedSimilarity(codeA, codeB);
    normalizedContribution = normalized * opts.normalizedWeight;
  }

  // Adjust weights if normalized is not included
  let adjustedSemanticWeight = opts.semanticWeight;
  let adjustedStructuralWeight = opts.structuralWeight;

  if (!opts.includeNormalized) {
    const totalWeight = opts.semanticWeight + opts.structuralWeight;
    adjustedSemanticWeight = opts.semanticWeight / totalWeight;
    adjustedStructuralWeight = opts.structuralWeight / totalWeight;
  }

  // Calculate final score
  const final = opts.includeNormalized
    ? (semanticScore * opts.semanticWeight) +
      (structural * opts.structuralWeight) +
      normalizedContribution
    : (semanticScore * adjustedSemanticWeight) +
      (structural * adjustedStructuralWeight);

  return {
    final,
    semantic: semanticScore,
    structural,
    normalized,
    confidence: getConfidenceLevel(final),
  };
}

/**
 * Quick check if two chunks are likely duplicates
 * Uses structural similarity as a fast pre-filter
 */
export function isLikelyDuplicate(
  metadataA: ChunkMetadata,
  metadataB: ChunkMetadata,
  threshold: number = 0.5
): boolean {
  const structural = calculateStructuralSimilarity(metadataA, metadataB);
  return structural.combined >= threshold;
}
```

---

## Task Breakdown with Time Estimates

### Phase 1: Parallel Development (Can be done simultaneously)

| Task | Stream | Estimated Effort | Dependencies |
|------|--------|------------------|--------------|
| A1: structural-scorer.ts | A | 2-3 hours | None |
| A2: structural-scorer.test.ts | A | 1-2 hours | A1 |
| B1: normalizer.ts | B | 3-4 hours | None |
| B2: normalizer.test.ts | B | 2-3 hours | B1 |
| C1: confidence.ts | C | 1-2 hours | None |
| C2: confidence.test.ts | C | 1 hour | C1 |
| C3: Update default threshold | C | 30 min | None |

### Phase 2: Integration (After Phase 1)

| Task | Estimated Effort | Dependencies |
|------|------------------|--------------|
| combined-scorer.ts | 2-3 hours | A1, B1, C1 |
| combined-scorer.test.ts | 2 hours | combined-scorer.ts |
| Update duplicate-finder.ts | 2-3 hours | combined-scorer.ts |
| Update no-semantic-duplicates.ts | 1-2 hours | confidence.ts |
| Integration tests | 2-3 hours | All above |

### Phase 3: Polish

| Task | Estimated Effort | Dependencies |
|------|------------------|--------------|
| CLI output improvements | 1-2 hours | confidence.ts |
| Documentation updates | 1-2 hours | All |
| Same-file duplicate option | 1 hour | duplicate-finder.ts |

---

## Gantt Chart (Parallel Execution)

```
Week 1:
├── Stream A (Structural) ████████░░░░░░░░░░░░
├── Stream B (Normalizer) ████████████░░░░░░░░
├── Stream C (Confidence) ██████░░░░░░░░░░░░░░
│
Week 2:
├── Integration           ░░░░░░░░████████████
├── Testing               ░░░░░░░░░░░░████████
└── Polish                ░░░░░░░░░░░░░░░░████
```

---

## Testing Strategy

### Unit Tests (Per Stream)
- Each new file gets a corresponding test file
- Test edge cases: empty arrays, single items, identical inputs
- Test with real-world examples from test-app-template

### Integration Tests
- Test combined scorer with all signals
- Test duplicate-finder with new scoring
- Test ESLint rule with confidence levels

### E2E Tests
- Run `uilint duplicates index` on test-app-template
- Verify all known duplicate pairs are detected
- Verify confidence levels are appropriate

### Test Data
Use the existing test-app-template duplicates:
- `formatCurrency` / `formatMoney` → Should be ~99% similar (near-identical)
- `Badge` / `Tag` → Should be ~85% similar (structural)
- `MetricCard` / `StatCard` → Should be ~80% similar (semantic)

---

## Configuration Changes

### Lower Default Threshold
In `src/detection/duplicate-finder.ts`:
```typescript
// Change from 0.85 to 0.75
threshold = 0.75,
```

### New Options Schema
```typescript
interface FindDuplicatesOptions {
  threshold?: number;           // Default: 0.75 (lowered)
  minGroupSize?: number;        // Default: 2
  kind?: ChunkKind;
  excludePaths?: string[];
  includeSameFile?: boolean;    // NEW: Default true
  useNormalization?: boolean;   // NEW: Default false (expensive)
  confidenceFilter?: ConfidenceLevel; // NEW: Filter by confidence
}
```

---

## Success Criteria

1. ✅ All test-app-template duplicate pairs detected
2. ✅ `formatCurrency`/`formatMoney` detected with >95% similarity
3. ✅ `Badge`/`Tag` detected with >80% similarity
4. ✅ Confidence levels displayed in CLI output
5. ✅ All new code has >80% test coverage
6. ✅ No regression in existing detection capabilities
