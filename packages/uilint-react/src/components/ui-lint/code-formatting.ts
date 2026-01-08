export type DedentResult = {
  lines: string[];
  /** Number of leading whitespace characters removed */
  removed: number;
};

function leadingWhitespace(s: string): string {
  const match = s.match(/^[\t ]+/);
  return match ? match[0] : "";
}

/**
 * Dedent a set of source lines by removing the minimum common leading indentation.
 *
 * - Ignores empty/whitespace-only lines when computing the minimum indent
 * - Removes up to that many leading whitespace characters from all lines
 * - Does not trim non-whitespace content
 */
export function dedentLines(lines: string[]): DedentResult {
  if (!lines.length) return { lines, removed: 0 };

  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (!nonEmpty.length) return { lines, removed: 0 };

  let min = Infinity;
  for (const l of nonEmpty) {
    min = Math.min(min, leadingWhitespace(l).length);
    if (min === 0) break;
  }

  if (!Number.isFinite(min) || min <= 0) return { lines, removed: 0 };

  return {
    removed: min,
    lines: lines.map((l) => (l.length >= min ? l.slice(min) : "")),
  };
}
