/**
 * High-precision timing helpers for CLI UX
 */

export function nsNow(): bigint {
  return process.hrtime.bigint();
}

export function nsToMs(ns: bigint): number {
  return Number(ns) / 1_000_000;
}

export function formatMs(ms: number): string {
  if (!Number.isFinite(ms)) return "n/a";
  if (ms < 1000) return `${ms.toFixed(ms < 10 ? 2 : ms < 100 ? 1 : 0)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 2 : 1)}s`;
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  return `${m}m ${rem.toFixed(rem < 10 ? 1 : 0)}s`;
}

export function maybeMs(ms: number | null | undefined): string {
  return ms == null ? "n/a" : formatMs(ms);
}
