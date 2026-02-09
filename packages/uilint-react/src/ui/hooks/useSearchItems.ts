/**
 * useSearchItems - Gather search items from all plugins
 *
 * Subscribes to store changes (issues, disabled rules) to trigger
 * recomputation. Analogous to useTileItems but for the new search system.
 */

import { useMemo } from "react";
import { useComposedStore } from "../../core/store";
import { selectIssuesMap } from "../../core/store/issues-selectors";
import { pluginRegistry } from "../../core/plugin-system/registry";
import type { SearchItem } from "../../core/plugin-system/types";

/**
 * Hook that gathers search items from all registered plugins.
 * Re-computes when issues or disabled rules change.
 *
 * @returns Array of SearchItem from all plugins
 */
export function useSearchItems(): SearchItem[] {
  // Subscribe to reactive dependencies that should trigger re-computation
  const issuesMap = useComposedStore(selectIssuesMap);
  const disabledRules = useComposedStore(
    (s) =>
      (s.plugins?.eslint as { disabledRules?: Set<string> } | undefined)
        ?.disabledRules
  );

  // issuesMap and disabledRules are reactive triggers —
  // they change when issues update, causing this memo to recompute.
  // pluginRegistry.getAllSearchItems() reads live state from plugins.
  const _reactiveIssues = issuesMap;
  const _reactiveRules = disabledRules;

  return useMemo(() => {
    return pluginRegistry.getAllSearchItems();
  }, [_reactiveIssues, _reactiveRules]);
}
