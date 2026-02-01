import { useCallback } from "react";
import {
  useComposedStore,
  selectIssuesMap,
  selectAllIssues,
  selectIssuesByFile,
  selectTotalIssueCount,
  selectSeverityCounts,
} from "../../core/store";
import type { Issue } from "../types";

/**
 * Hook that aggregates issues from all plugin slices.
 *
 * Uses Zustand selectors for derived state - all filtering and aggregation
 * is performed in the store selectors, not in this hook.
 */
export function useIssues() {
  // Use store selectors for all derived state
  const allIssues = useComposedStore(selectAllIssues);
  const byFile = useComposedStore(selectIssuesByFile);
  const byDataLoc = useComposedStore(selectIssuesMap);
  const totalCount = useComposedStore(selectTotalIssueCount);
  const countBySeverity = useComposedStore(selectSeverityCounts);

  // Keep getIssuesForDataLoc as callback for direct lookup
  const getIssuesForDataLoc = useCallback(
    (dataLoc: string): Issue[] => {
      return byDataLoc.get(dataLoc) || [];
    },
    [byDataLoc]
  );

  return {
    allIssues,
    byFile,
    byDataLoc,
    getIssuesForDataLoc,
    totalCount,
    countBySeverity,
  };
}
