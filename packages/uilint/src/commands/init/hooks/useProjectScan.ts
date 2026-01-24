/**
 * useProjectScan hook - React hook for scanning project state
 *
 * This wraps the analyze function in a React hook pattern suitable for Ink,
 * providing loading states and error handling.
 */

import { useState, useEffect } from "react";
import { analyze } from "../analyze.js";
import type { ProjectState } from "../types.js";

export interface ProjectScanState {
  /** Whether the scan is currently running */
  loading: boolean;
  /** Scan error if any */
  error: string | null;
  /** Project state result (null until scan completes) */
  state: ProjectState | null;
}

/**
 * Hook to scan project and return its state
 *
 * @param projectPath - The project directory to analyze (defaults to cwd)
 * @returns ProjectScanState with loading status, error, and project state
 */
export function useProjectScan(
  projectPath: string = process.cwd()
): ProjectScanState {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<ProjectState | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function runScan() {
      try {
        setLoading(true);
        setError(null);
        const result = await analyze(projectPath);
        if (!cancelled) {
          setState(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    runScan();

    return () => {
      cancelled = true;
    };
  }, [projectPath]);

  return { loading, error, state };
}
