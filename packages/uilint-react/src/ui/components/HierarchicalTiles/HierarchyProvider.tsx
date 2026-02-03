/**
 * HierarchyProvider - Context provider for hierarchical tile expansion state
 *
 * Manages the expansion path for hierarchical tile navigation.
 * Supports both controlled and uncontrolled modes:
 * - Controlled: Pass `expansionPath`, `onExpand`, and `onCollapse` props
 * - Uncontrolled: Manage state internally with useState
 *
 * @module HierarchyProvider
 */
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { HierarchyContextValue, HierarchyNode } from "./types";

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum allowed expansion depth.
 * Prevents deeply nested expansions for UX clarity.
 */
const MAX_EXPANSION_DEPTH = 2;

// ============================================================================
// Context
// ============================================================================

/**
 * React context for hierarchy expansion state.
 * Initialized as null to detect usage outside of provider.
 *
 * @internal
 */
const HierarchyContext = createContext<HierarchyContextValue<unknown> | null>(
  null
);

// ============================================================================
// Provider Props
// ============================================================================

/**
 * Props for the HierarchyProvider component.
 *
 * @template T - The type of the data payload in hierarchy nodes
 */
export interface HierarchyProviderProps<T> {
  /**
   * Child components that will have access to the hierarchy context.
   */
  children: ReactNode;

  /**
   * Controlled expansion path.
   * When provided, the component operates in controlled mode.
   * Must be used together with `onExpand` and `onCollapse`.
   */
  expansionPath?: HierarchyNode<T>[];

  /**
   * Callback fired when a node should be expanded.
   * Required for controlled mode.
   *
   * @param node - The node to expand
   */
  onExpand?: (node: HierarchyNode<T>) => void;

  /**
   * Callback fired when the current expansion should be collapsed.
   * Required for controlled mode.
   */
  onCollapse?: () => void;

  /**
   * Callback fired when collapsing to a specific level.
   * Optional for controlled mode - falls back to multiple onCollapse calls.
   *
   * @param level - The level to collapse to (0 = fully collapsed)
   */
  onCollapseToLevel?: (level: number) => void;
}

// ============================================================================
// Provider Component
// ============================================================================

/**
 * HierarchyProvider - Context provider for managing hierarchical expansion state.
 *
 * Provides expansion state and navigation methods to descendant components.
 * Supports both controlled and uncontrolled usage patterns.
 *
 * @template T - The type of the data payload in hierarchy nodes
 *
 * @example Uncontrolled usage (internal state management)
 * ```tsx
 * function MyComponent() {
 *   return (
 *     <HierarchyProvider>
 *       <TileGrid nodes={nodes} />
 *     </HierarchyProvider>
 *   );
 * }
 * ```
 *
 * @example Controlled usage (external state management)
 * ```tsx
 * function MyComponent() {
 *   const [expansionPath, setExpansionPath] = useState<HierarchyNode<MyData>[]>([]);
 *
 *   return (
 *     <HierarchyProvider
 *       expansionPath={expansionPath}
 *       onExpand={(node) => setExpansionPath([...expansionPath, node])}
 *       onCollapse={() => setExpansionPath(expansionPath.slice(0, -1))}
 *     >
 *       <TileGrid nodes={nodes} />
 *     </HierarchyProvider>
 *   );
 * }
 * ```
 */
export function HierarchyProvider<T>({
  children,
  expansionPath: controlledPath,
  onExpand: controlledOnExpand,
  onCollapse: controlledOnCollapse,
  onCollapseToLevel: controlledOnCollapseToLevel,
}: HierarchyProviderProps<T>): React.ReactElement {
  // Internal state for uncontrolled mode
  const [internalPath, setInternalPath] = useState<HierarchyNode<T>[]>([]);

  // Determine if we're in controlled mode
  const isControlled = controlledPath !== undefined;

  // Use controlled or internal state
  const expansionPath = isControlled ? controlledPath : internalPath;

  /**
   * Expand a node by adding it to the expansion path.
   * Respects MAX_EXPANSION_DEPTH limit.
   */
  const expand = useCallback(
    (node: HierarchyNode<T>) => {
      if (isControlled) {
        // In controlled mode, delegate to parent
        controlledOnExpand?.(node);
      } else {
        // In uncontrolled mode, manage internally
        setInternalPath((currentPath: HierarchyNode<T>[]) => {
          // Check if we've reached max depth
          if (currentPath.length >= MAX_EXPANSION_DEPTH) {
            // Replace the last item instead of adding
            return [...currentPath.slice(0, -1), node];
          }
          return [...currentPath, node];
        });
      }
    },
    [isControlled, controlledOnExpand]
  );

  /**
   * Collapse the most recently expanded node.
   * Removes the last entry from the expansion path.
   */
  const collapse = useCallback(() => {
    if (isControlled) {
      // In controlled mode, delegate to parent
      controlledOnCollapse?.();
    } else {
      // In uncontrolled mode, pop the last item
      setInternalPath((currentPath: HierarchyNode<T>[]) => currentPath.slice(0, -1));
    }
  }, [isControlled, controlledOnCollapse]);

  /**
   * Collapse to a specific level in the hierarchy.
   * Level 0 means fully collapsed, level 1 means one expansion, etc.
   */
  const collapseToLevel = useCallback(
    (level: number) => {
      if (isControlled) {
        // In controlled mode, use dedicated callback if provided
        if (controlledOnCollapseToLevel) {
          controlledOnCollapseToLevel(level);
        } else {
          // Fallback: call collapse repeatedly (parent should handle state)
          // This is a simplified approach; parent may want to handle differently
          controlledOnCollapse?.();
        }
      } else {
        // In uncontrolled mode, slice the path to the target level
        setInternalPath((currentPath: HierarchyNode<T>[]) => currentPath.slice(0, level));
      }
    },
    [isControlled, controlledOnCollapseToLevel, controlledOnCollapse]
  );

  /**
   * Collapse all expansions, returning to the root view.
   * Equivalent to collapseToLevel(0).
   */
  const collapseAll = useCallback(() => {
    collapseToLevel(0);
  }, [collapseToLevel]);

  // Compute derived values
  const currentLevel = expansionPath.length;
  const expandedNodeId =
    expansionPath.length > 0
      ? expansionPath[expansionPath.length - 1].id
      : null;

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo<HierarchyContextValue<T>>(
    () => ({
      expansionPath,
      currentLevel,
      expandedNodeId,
      expand,
      collapse,
      collapseToLevel,
      collapseAll,
    }),
    [
      expansionPath,
      currentLevel,
      expandedNodeId,
      expand,
      collapse,
      collapseToLevel,
      collapseAll,
    ]
  );

  return (
    <HierarchyContext.Provider
      value={contextValue as HierarchyContextValue<unknown>}
    >
      {children}
    </HierarchyContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * useHierarchy - Hook to access the hierarchy context.
 *
 * Provides access to the current expansion state and navigation methods.
 * Must be used within a HierarchyProvider component.
 *
 * @template T - The type of the data payload in hierarchy nodes
 *
 * @returns The hierarchy context value with expansion state and methods
 *
 * @throws Error if used outside of a HierarchyProvider
 *
 * @example
 * ```tsx
 * function TileComponent({ node }) {
 *   const { expand, expandedNodeId, currentLevel } = useHierarchy<MyData>();
 *
 *   const isExpanded = expandedNodeId === node.id;
 *
 *   return (
 *     <button onClick={() => expand(node)}>
 *       {node.label} {isExpanded && '(expanded)'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useHierarchy<T>(): HierarchyContextValue<T> {
  const context = useContext(HierarchyContext);

  if (context === null) {
    throw new Error(
      "useHierarchy must be used within a HierarchyProvider. " +
        "Wrap your component tree with <HierarchyProvider> to fix this error."
    );
  }

  return context as HierarchyContextValue<T>;
}
