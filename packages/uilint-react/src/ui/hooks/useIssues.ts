import { useMemo, useCallback } from "react";
import { useComposedStore } from "../../core/store";
import type { Issue } from "../types";

/**
 * Hook that aggregates issues from all plugin slices
 */
export function useIssues() {
  // Get issues from ESLint plugin (Map<dataLoc, Issue[]>)
  const eslintIssues = useComposedStore((s) => s.plugins?.eslint?.issues);

  // Flatten all issues into array
  const allIssues = useMemo(() => {
    const result: Issue[] = [];
    eslintIssues?.forEach((issues) => result.push(...issues));
    return result;
  }, [eslintIssues]);

  // Group by file path
  const byFile = useMemo(() => {
    const map = new Map<string, Issue[]>();
    for (const issue of allIssues) {
      const existing = map.get(issue.filePath) || [];
      existing.push(issue);
      map.set(issue.filePath, existing);
    }
    return map;
  }, [allIssues]);

  // Get issues for a specific dataLoc
  const getIssuesForDataLoc = useCallback(
    (dataLoc: string): Issue[] => {
      return eslintIssues?.get(dataLoc) || [];
    },
    [eslintIssues]
  );

  // Total count
  const totalCount = allIssues.length;

  // Count by severity
  const countBySeverity = useMemo(
    () => ({
      error: allIssues.filter((i) => i.severity === "error").length,
      warning: allIssues.filter((i) => i.severity === "warning").length,
      info: allIssues.filter((i) => i.severity === "info").length,
    }),
    [allIssues]
  );

  return {
    allIssues,
    byFile,
    byDataLoc: eslintIssues ?? new Map(),
    getIssuesForDataLoc,
    totalCount,
    countBySeverity,
  };
}
