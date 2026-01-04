/**
 * Tailwind / utility-class token extraction helpers.
 *
 * Notes:
 * - Works on HTML (class="...") and TSX-ish input (className="...") via regex.
 * - Variant parsing is bracket-aware so arbitrary values like bg-[color:var(--x)]
 *   don't get split incorrectly on ":".
 */

export interface ClassTokenCounts {
  /**
   * Base utilities with variants stripped.
   * Example: "sm:hover:bg-gray-50" => utility "bg-gray-50"
   */
  utilities: Map<string, number>;
  /**
   * Individual variant prefixes.
   * Example: "sm:hover:bg-gray-50" => variants "sm", "hover"
   */
  variants: Map<string, number>;
}

export interface ExtractClassTokenOptions {
  /**
   * Maximum number of tokens to process (guardrail for very large inputs).
   */
  maxTokens?: number;
}

export function extractClassTokensFromHtml(
  html: string,
  options: ExtractClassTokenOptions = {}
): ClassTokenCounts {
  const { maxTokens = 20000 } = options;

  const utilities = new Map<string, number>();
  const variants = new Map<string, number>();

  if (!html) return { utilities, variants };

  // Match both HTML and JSX-ish attributes.
  // - class="..."
  // - className="..."
  const attrPattern = /\b(?:class|className)\s*=\s*["']([^"']+)["']/g;

  let tokenBudget = maxTokens;
  let match: RegExpExecArray | null;
  while ((match = attrPattern.exec(html)) && tokenBudget > 0) {
    const raw = match[1];
    if (!raw) continue;

    const tokens = raw.split(/\s+/g).filter(Boolean);
    for (const token of tokens) {
      if (tokenBudget-- <= 0) break;

      const { base, variantList } = splitVariants(token);
      const normalizedBase = normalizeUtility(base);
      if (!normalizedBase) continue;

      increment(utilities, normalizedBase);
      for (const v of variantList) increment(variants, v);
    }
  }

  return { utilities, variants };
}

export function topEntries(
  map: Map<string, number>,
  limit: number
): Array<{ token: string; count: number }> {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([token, count]) => ({ token, count }));
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) || 0) + 1);
}

function normalizeUtility(token: string): string | null {
  const t = token.trim();
  if (!t) return null;

  // Strip important modifier
  const noImportant = t.startsWith("!") ? t.slice(1) : t;

  // Ignore obviously non-class tokens
  if (!noImportant || noImportant === "{" || noImportant === "}") return null;

  return noImportant;
}

/**
 * Splits a class token into variants and base utility.
 * Bracket-aware to avoid splitting arbitrary values on ":".
 *
 * Examples:
 * - "sm:hover:bg-gray-50" => variants ["sm","hover"], base "bg-gray-50"
 * - "bg-[color:var(--x)]" => variants [], base "bg-[color:var(--x)]"
 * - "sm:bg-[color:var(--x)]" => variants ["sm"], base "bg-[color:var(--x)]"
 */
function splitVariants(token: string): { base: string; variantList: string[] } {
  const parts: string[] = [];
  let buf = "";
  let bracketDepth = 0;

  for (let i = 0; i < token.length; i++) {
    const ch = token[i];
    if (ch === "[") bracketDepth++;
    if (ch === "]" && bracketDepth > 0) bracketDepth--;

    if (ch === ":" && bracketDepth === 0) {
      parts.push(buf);
      buf = "";
      continue;
    }

    buf += ch;
  }
  parts.push(buf);

  if (parts.length <= 1) return { base: token, variantList: [] };

  const base = parts[parts.length - 1] || "";
  const variantList = parts
    .slice(0, -1)
    .map((v) => v.trim())
    .filter(Boolean);

  return { base, variantList };
}

