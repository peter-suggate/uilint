/**
 * Code Normalizer
 *
 * Normalizes code before comparison to improve duplicate detection:
 * 1. Replaces identifiers with canonical placeholders (for near-identical detection)
 * 2. Normalizes semantic equivalents (size/dimension, onClick/onPress)
 * 3. Strips comments and normalizes whitespace
 *
 * This is particularly useful for detecting utility functions that are
 * copy-pasted with only variable name changes.
 */

export interface NormalizationOptions {
  /** Replace all local identifiers with placeholders (aggressive) */
  normalizeIdentifiers?: boolean;
  /** Normalize semantic equivalents like size/dimension */
  normalizeSemantics?: boolean;
  /** Strip comments from code */
  stripComments?: boolean;
  /** Normalize whitespace to single spaces */
  normalizeWhitespace?: boolean;
}

export const DEFAULT_NORMALIZATION_OPTIONS: NormalizationOptions = {
  normalizeIdentifiers: false,
  normalizeSemantics: true,
  stripComments: true,
  normalizeWhitespace: true,
};

/**
 * Semantic equivalent patterns.
 * Maps common naming variations to canonical forms.
 */
const SEMANTIC_EQUIVALENTS: Array<[RegExp, string]> = [
  // Size-related props
  [/\b(size|dimension|scale|magnitude)\b/gi, "__SIZE__"],
  // Variant-related props
  [/\b(variant|type|kind|style|mode)\b/gi, "__VARIANT__"],
  // Click/press handlers
  [/\b(onClick|onPress|onTap|handleClick|handlePress|onSelect)\b/g, "__CLICK_HANDLER__"],
  // Change handlers
  [/\b(onChange|onInput|handleChange|handleInput)\b/g, "__CHANGE_HANDLER__"],
  // Submit handlers
  [/\b(onSubmit|handleSubmit)\b/g, "__SUBMIT_HANDLER__"],
  // Loading states
  [/\b(loading|isLoading|pending|isFetching|isBusy)\b/gi, "__LOADING__"],
  // Error states
  [/\b(error|err|errorMsg|errorMessage|failure)\b/gi, "__ERROR__"],
  // Success states
  [/\b(success|isSuccess|succeeded|done)\b/gi, "__SUCCESS__"],
  // Data/items collections
  [/\b(data|items|list|results|entries|records)\b/gi, "__DATA__"],
  // Children/content slots
  [/\b(children|content|body|slot|inner)\b/gi, "__CHILDREN__"],
  // Label/title text
  [/\b(label|title|heading|name|text)\b/gi, "__LABEL__"],
  // Description/message
  [/\b(description|message|subtitle|detail|info)\b/gi, "__DESCRIPTION__"],
  // Value/amount
  [/\b(value|amount|total|count|number)\b/gi, "__VALUE__"],
  // Disabled state
  [/\b(disabled|isDisabled|readonly|readOnly)\b/gi, "__DISABLED__"],
  // Visible/shown state
  [/\b(visible|isVisible|shown|isShown|open|isOpen)\b/gi, "__VISIBLE__"],
  // Class names
  [/\b(className|classes|style|styles)\b/gi, "__CLASSNAME__"],
];

/**
 * Strip comments from code.
 */
function stripComments(code: string): string {
  // Remove single-line comments
  let result = code.replace(/\/\/.*$/gm, "");
  // Remove multi-line comments
  result = result.replace(/\/\*[\s\S]*?\*\//g, "");
  return result;
}

/**
 * Normalize whitespace to single spaces.
 */
function normalizeWhitespace(code: string): string {
  return code
    .replace(/\s+/g, " ")
    .replace(/\s*([{}[\]();,:<>])\s*/g, "$1")
    .trim();
}

/**
 * Apply semantic normalization patterns.
 */
function applySemanticNormalization(code: string): string {
  let result = code;
  for (const [pattern, replacement] of SEMANTIC_EQUIVALENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Normalize identifiers by replacing them with sequential placeholders.
 * This is an aggressive normalization that makes structurally identical
 * code with different variable names appear identical.
 */
function normalizeIdentifiersSimple(code: string): string {
  const identifierMap = new Map<string, string>();
  let counter = 0;

  // Match potential identifiers (simplified approach without full AST parsing)
  // This matches word characters that look like identifiers
  const identifierPattern = /\b([a-z_$][a-z0-9_$]*)\b/gi;

  // Built-in keywords and common globals to preserve
  const preserveList = new Set([
    // JavaScript keywords
    "const",
    "let",
    "var",
    "function",
    "return",
    "if",
    "else",
    "for",
    "while",
    "do",
    "switch",
    "case",
    "break",
    "continue",
    "default",
    "try",
    "catch",
    "finally",
    "throw",
    "new",
    "this",
    "class",
    "extends",
    "super",
    "import",
    "export",
    "from",
    "as",
    "async",
    "await",
    "yield",
    "typeof",
    "instanceof",
    "in",
    "of",
    "void",
    "delete",
    "true",
    "false",
    "null",
    "undefined",
    // TypeScript keywords
    "interface",
    "type",
    "enum",
    "implements",
    "private",
    "public",
    "protected",
    "readonly",
    "abstract",
    "declare",
    "namespace",
    "module",
    // React hooks
    "useState",
    "useEffect",
    "useCallback",
    "useMemo",
    "useRef",
    "useContext",
    "useReducer",
    "useLayoutEffect",
    "useImperativeHandle",
    "useDebugValue",
    "useDeferredValue",
    "useTransition",
    "useId",
    "useSyncExternalStore",
    "useInsertionEffect",
    // React
    "React",
    "Component",
    "Fragment",
    "Suspense",
    "memo",
    "forwardRef",
    "createContext",
    "createElement",
    // Common globals
    "console",
    "window",
    "document",
    "Math",
    "Date",
    "JSON",
    "Object",
    "Array",
    "String",
    "Number",
    "Boolean",
    "Promise",
    "Set",
    "Map",
    "WeakSet",
    "WeakMap",
    "Symbol",
    "Error",
    "RegExp",
    "Intl",
    "setTimeout",
    "setInterval",
    "clearTimeout",
    "clearInterval",
    "fetch",
    "require",
    // Common type names
    "string",
    "number",
    "boolean",
    "object",
    "any",
    "unknown",
    "never",
    "void",
    // Normalized placeholders (preserve these)
    "__SIZE__",
    "__VARIANT__",
    "__CLICK_HANDLER__",
    "__CHANGE_HANDLER__",
    "__SUBMIT_HANDLER__",
    "__LOADING__",
    "__ERROR__",
    "__SUCCESS__",
    "__DATA__",
    "__CHILDREN__",
    "__LABEL__",
    "__DESCRIPTION__",
    "__VALUE__",
    "__DISABLED__",
    "__VISIBLE__",
    "__CLASSNAME__",
  ]);

  return code.replace(identifierPattern, (match) => {
    // Preserve keywords and built-ins
    if (preserveList.has(match) || preserveList.has(match.toLowerCase())) {
      return match;
    }

    // Get or create placeholder for this identifier
    const key = match.toLowerCase();
    if (!identifierMap.has(key)) {
      identifierMap.set(key, `_ID${counter++}_`);
    }
    return identifierMap.get(key)!;
  });
}

/**
 * Normalize code for comparison.
 *
 * @param code The source code to normalize
 * @param options Normalization options
 * @returns Normalized code string
 */
export function normalizeCode(
  code: string,
  options: NormalizationOptions = DEFAULT_NORMALIZATION_OPTIONS
): string {
  let result = code;

  // Strip comments first
  if (options.stripComments) {
    result = stripComments(result);
  }

  // Apply semantic normalization
  if (options.normalizeSemantics) {
    result = applySemanticNormalization(result);
  }

  // Normalize identifiers (most aggressive, do last before whitespace)
  if (options.normalizeIdentifiers) {
    result = normalizeIdentifiersSimple(result);
  }

  // Normalize whitespace last
  if (options.normalizeWhitespace) {
    result = normalizeWhitespace(result);
  }

  return result;
}

/**
 * Calculate Levenshtein distance between two strings.
 * Used for fuzzy matching of normalized code.
 */
export function levenshteinDistance(a: string, b: string): number {
  // Early termination for identical strings
  if (a === b) return 0;

  // Early termination for empty strings
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Use two-row optimization for memory efficiency
  let previousRow = new Array(b.length + 1);
  let currentRow = new Array(b.length + 1);

  // Initialize first row
  for (let j = 0; j <= b.length; j++) {
    previousRow[j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= a.length; i++) {
    currentRow[0] = i;

    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currentRow[j] = Math.min(
        previousRow[j] + 1, // Deletion
        currentRow[j - 1] + 1, // Insertion
        previousRow[j - 1] + cost // Substitution
      );
    }

    // Swap rows
    [previousRow, currentRow] = [currentRow, previousRow];
  }

  return previousRow[b.length];
}

/**
 * Calculate normalized similarity between two code snippets.
 * Returns 1.0 for identical normalized code, lower for differences.
 *
 * @param codeA First code snippet
 * @param codeB Second code snippet
 * @param options Normalization options
 * @returns Similarity score between 0 and 1
 */
export function calculateNormalizedSimilarity(
  codeA: string,
  codeB: string,
  options: NormalizationOptions = { normalizeIdentifiers: true, normalizeSemantics: true }
): number {
  const normalizedA = normalizeCode(codeA, options);
  const normalizedB = normalizeCode(codeB, options);

  // Exact match after normalization
  if (normalizedA === normalizedB) {
    return 1.0;
  }

  // Calculate Levenshtein-based similarity
  const distance = levenshteinDistance(normalizedA, normalizedB);
  const maxLen = Math.max(normalizedA.length, normalizedB.length);

  if (maxLen === 0) return 1.0;

  return 1 - distance / maxLen;
}

/**
 * Quick check if two code snippets are near-identical after normalization.
 *
 * @param codeA First code snippet
 * @param codeB Second code snippet
 * @param threshold Minimum similarity to consider near-identical (default: 0.95)
 * @returns True if the code is near-identical
 */
export function isNearIdentical(
  codeA: string,
  codeB: string,
  threshold: number = 0.95
): boolean {
  return calculateNormalizedSimilarity(codeA, codeB) >= threshold;
}

/**
 * Prepare code for embedding by applying light normalization.
 * This is less aggressive than full normalization and is meant
 * to improve embedding quality without losing semantic meaning.
 *
 * @param code The source code
 * @returns Lightly normalized code for embedding
 */
export function prepareForEmbedding(code: string): string {
  return normalizeCode(code, {
    normalizeIdentifiers: false,
    normalizeSemantics: true,
    stripComments: true,
    normalizeWhitespace: false, // Preserve structure for embedding
  });
}
