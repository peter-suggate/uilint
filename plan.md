# Plan: Unified Treemap Inspector with Ghost Cell Animations

## Overview

Replace the current split architecture (TreemapGrid + IssuesList with `renderZoomedContent` callback) with a **single composite view** (`TreemapInspector`) backed by a **standalone Zustand store** for treemap-specific state. Ghost file cells pre-rendered inside rule cells enable smooth `layoutId`-based spatial animations on zoom.

---

## Current Architecture (problems)

```
InspectorSidebar
  └── IssuesList (reads composed store, massive component)
        ├── TreemapGrid (manages AnimatePresence crossfade)
        │     ├── Root: rule cells
        │     └── Zoomed: renderZoomedContent(callback) ← indirection
        ├── FileTreemap (inline sub-component)
        ├── Breadcrumbs, RuleHeader, FileSourceView...
        └── 500+ lines of callbacks, effects, memos
```

**Problems:**
1. Ghost cells can't span the callback boundary — TreemapGrid renders root, IssuesList renders zoomed content, they don't share a DOM tree
2. `AnimatePresence mode="wait"` prevents overlapping root/zoomed views, breaking `layoutId`
3. All navigation state is in the composed store, but treemap-specific state (animation phase, ghost layouts, container size) has nowhere to live
4. IssuesList is 600 lines of mixed concerns

## Target Architecture

```
InspectorSidebar
  └── TreemapInspector (single composite view)
        ├── useTreemapStore (standalone store: animation, layout, container)
        ├── useComposedStore (data: fileGroups, rules, navigation)
        │
        ├── Layer 1: Root rule cells (AnimatePresence)
        ├── Layer 2: Ghost file cells (AnimatePresence, layoutId)
        ├── Layer 3: Zoomed view (AnimatePresence, layoutId match)
        │     ├── ContextStrip
        │     ├── Breadcrumbs + RuleHeader
        │     └── FileTreemap / FileSourceView / DuplicateIssueList
        └── All in one DOM tree under LayoutGroup
```

---

## Parallel Implementation Streams

```
Stream A: Standalone Store ──────────────────────────────┐
                                                          │
Stream B: TreemapCell ghost/layoutId ────────────────────├──→ Stream D: TreemapInspector
                                                          │    composite view
Stream C: Animation system updates ──────────────────────┘
                                                               │
                                                               ↓
                                                         Stream E: Integration
                                                         (wire in, remove old code)
```

**A, B, C** are fully independent — zero dependencies between them.
**D** consumes A + B + C interfaces.
**E** wires D into InspectorSidebar, removes IssuesList/TreemapGrid.

---

## Stream A: Standalone Treemap Store

**New file: `ui/components/Inspector/treemap-inspector-store.ts`**
**New file: `ui/components/Inspector/treemap-inspector-store.test.ts`**

A standalone Zustand `create()` store for state that doesn't belong in the composed store. Navigation state stays in the composed store (HeatmapOverlay and CommandPalette already dispatch there).

```typescript
import { create } from "zustand";

interface TreemapInspectorState {
  // ===== Container dimensions (ResizeObserver) =====
  containerWidth: number;
  containerHeight: number;
  setContainerSize: (width: number, height: number) => void;

  // ===== Animation state =====
  /** Whether a zoom transition is in progress */
  isTransitioning: boolean;
  /** Direction of current transition */
  transitionDirection: "zoom-in" | "zoom-out" | null;
  /** Previous zoomed rule ID — needed to keep ghost cells mounted during zoom-out */
  previousZoomedRuleId: string | null;
  /** Start a zoom transition */
  startTransition: (direction: "zoom-in" | "zoom-out", previousRuleId?: string | null) => void;
  /** End the zoom transition (called by onAnimationComplete) */
  endTransition: () => void;

  // ===== Pre-computed file children for ghost cells =====
  /** Map of ruleId → file tile items, computed for all rules */
  fileItemsByRule: Map<string, BaseTileItem[]>;
  setFileItemsByRule: (map: Map<string, BaseTileItem[]>) => void;
}
```

**Tests:**
- `setContainerSize` updates dimensions
- `startTransition` / `endTransition` cycle
- `previousZoomedRuleId` is set on zoom-out start, cleared on end
- `setFileItemsByRule` replaces the map

---

## Stream B: TreemapCell Ghost + LayoutId Support

**Modified file: `HierarchicalTiles/TreemapCell.tsx`**
**Modified file: `HierarchicalTiles/TreemapCell.test.tsx`**

### New props:

```typescript
export interface TreemapCellProps {
  // ... existing props ...

  /** Framer Motion layoutId for cross-view spatial animations */
  layoutId?: string;

  /** Ghost mode: invisible, non-interactive, no content — just a positioned anchor */
  ghost?: boolean;
}
```

### Ghost mode behavior:

```tsx
<motion.div
  data-treemap-cell={id}
  layoutId={layoutId}                           // Enable layout animation
  variants={ghost ? ghostCellVariants : treemapCellVariants}
  initial="hidden"
  animate="visible"
  exit="exit"
  transition={ghost ? { duration: 0.01 } : { ... }}
  whileHover={ghost ? undefined : { scale: 1.01 }}
  whileTap={ghost ? undefined : { scale: 0.98 }}
  className={cn(
    "absolute overflow-hidden",
    ghost ? "pointer-events-none" : "cursor-pointer rounded-xl border ...",
    !ghost && styles.bg,
    ...
  )}
  style={{
    left: x, top: y, width, height,
    opacity: ghost ? 0 : getIntensityOpacity(areaFraction),
  }}
>
  {/* No content for ghost cells */}
  {!ghost && contentLevel === "full" && <FullContent ... />}
  {!ghost && contentLevel === "compact" && <CompactContent ... />}
</motion.div>
```

### Tests to add:
- `ghost=true` renders with opacity 0
- `ghost=true` has `pointer-events-none` class
- `ghost=true` renders no text content
- `ghost=true` still has `data-treemap-cell` attribute
- `layoutId` prop is passed through (update mock to strip it)

---

## Stream C: Animation System Updates

**Modified file: `HierarchicalTiles/animations/treemap-animations.ts`**

### New exports:

```typescript
/** Ghost cells: always invisible, layoutId handles the visual transition */
export const ghostCellVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 0 },
  exit: { opacity: 0 },
};

/** Layout transition for file cells using layoutId */
export const fileLayoutTransition: Transition = {
  duration: ZOOM_DURATION,
  ease: crispEase,
};
```

### Modified: root exit (less dramatic, concurrent with file expansion)

```typescript
export const rootTreemapVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0 },  // Just fade, no scale — file ghosts animate separately
};
```

### Update `animations/index.ts` exports

---

## Stream D: TreemapInspector Composite View

**New file: `ui/components/Inspector/TreemapInspector.tsx`**
**New file: `ui/components/Inspector/TreemapInspector.test.tsx`**

This is the big one — a single component that composites all hierarchy levels with ghost cells. It replaces both `TreemapGrid` and `IssuesList`.

### Data flow:

```typescript
function TreemapInspector({ className }: { className?: string }) {
  // ===== Navigation state (from composed store) =====
  const fileGroups = useComposedStore(selectFileGroups);
  const expandedRuleId = useComposedStore((s) => s.inspector.expandedRuleId);
  const expandedFilePath = useComposedStore((s) => s.inspector.expandedFilePath);
  const selectedIssueId = useComposedStore((s) => s.inspector.selectedIssueId);
  const showFullSource = useComposedStore((s) => s.inspector.showFullSource);
  const availableWidth = useComposedStore((s) => s.inspector.layoutAvailableWidth);
  // ... actions: expandRule, collapseRule, expandFileInRule, etc.

  // ===== Treemap-specific state (from standalone store) =====
  const containerHeight = useTreemapStore((s) => s.containerHeight);
  const fileItemsByRule = useTreemapStore((s) => s.fileItemsByRule);
  const isTransitioning = useTreemapStore((s) => s.isTransitioning);
  const setContainerSize = useTreemapStore((s) => s.setContainerSize);
  const setFileItemsByRule = useTreemapStore((s) => s.setFileItemsByRule);

  // ===== Derived data =====
  const ruleNodes = useMemo(() => fileGroupsToRuleNodes(fileGroups), [fileGroups]);
  const ruleTileItems = useMemo(() => ruleNodes.map(...), [ruleNodes]);
  // ... same data transforms currently in IssuesList
```

### Layout computations (all in one place):

```typescript
  // Root treemap layout
  const rootLayout = useMemo(
    () => calculateTreemapLayout(toTreemapItems(ruleTileItems), { width, height, gap: 2 }),
    [ruleTileItems, width, height]
  );

  // Ghost layouts: mini file treemaps inside each rule cell
  const ghostLayouts = useMemo(() => {
    const map = new Map();
    for (const item of ruleTileItems) {
      const cell = rootLayout.cells.get(item.id);
      const fileItems = fileItemsByRule.get(item.id);
      if (!cell || !fileItems?.length) continue;
      map.set(item.id, calculateTreemapLayout(
        toTreemapItems(fileItems),
        { width: cell.width, height: cell.height, gap: 1 }
      ));
    }
    return map;
  }, [ruleTileItems, rootLayout, fileItemsByRule]);

  // Zoomed file treemap layout (full size)
  const zoomedFileLayout = useMemo(() => {
    if (!expandedRuleId) return null;
    const fileItems = fileItemsByRule.get(expandedRuleId);
    if (!fileItems?.length) return null;
    return calculateTreemapLayout(
      toTreemapItems(fileItems),
      { width: availableWidth, height: FILE_TREEMAP_HEIGHT, gap: 2 }
    );
  }, [expandedRuleId, fileItemsByRule, availableWidth]);
```

### DOM structure (the key part):

```tsx
  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div ref={containerRef} className="flex-1 p-4 overflow-auto">
        {ruleNodes.length === 0 ? <EmptyState /> : (
          <LayoutGroup>
            <div className="relative" style={{ width: availableWidth, height }}>

              {/* ======= Layer 1: Root rule cells ======= */}
              <AnimatePresence>
                {!expandedRuleId && (
                  <motion.div key="root-rules" variants={rootTreemapVariants} ...>
                    {ruleTileItems.map((item, i) => {
                      const cell = rootLayout.cells.get(item.id);
                      return <TreemapCell key={item.id} {...cellProps} />;
                    })}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ======= Layer 2: Ghost file cells ======= */}
              <AnimatePresence>
                {!expandedRuleId && ruleTileItems.flatMap(item => {
                  const parentCell = rootLayout.cells.get(item.id);
                  const ghostLayout = ghostLayouts.get(item.id);
                  const fileItems = fileItemsByRule.get(item.id);
                  if (!parentCell || !ghostLayout || !fileItems) return [];
                  return fileItems.map((file, fi) => {
                    const gc = ghostLayout.cells.get(file.id);
                    if (!gc) return null;
                    return (
                      <TreemapCell
                        key={`ghost-${file.id}`}
                        layoutId={`treemap-file-${file.id}`}
                        ghost={true}
                        x={parentCell.x + gc.x}
                        y={parentCell.y + gc.y}
                        width={gc.width}
                        height={gc.height}
                        {...fileProps}
                      />
                    );
                  });
                })}
              </AnimatePresence>

              {/* ======= Layer 3: Zoomed view ======= */}
              <AnimatePresence>
                {expandedRuleId && expandedRule && (
                  <motion.div key={`zoomed-${expandedRuleId}`} variants={zoomedViewVariants} ...
                    className="absolute inset-0 flex flex-col"
                  >
                    <ContextStrip items={stripItems} activeId={expandedRuleId} ... />

                    <div className="flex-1 flex flex-col overflow-hidden">
                      <Breadcrumbs ... />
                      <RuleHeader ... />

                      {/* File treemap OR file source */}
                      {!expandedFilePath ? (
                        <div className="p-3">
                          <div className="relative" style={{ ... }}>
                            {fileItems.map((file, fi) => {
                              const cell = zoomedFileLayout?.cells.get(file.id);
                              return (
                                <TreemapCell
                                  key={file.id}
                                  layoutId={`treemap-file-${file.id}`}  // Matches ghost!
                                  {...fullFileProps}
                                />
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        /* FileSourceView / IssueSummaryView / DuplicateIssueList */
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </LayoutGroup>
        )}
      </div>
    </div>
  );
```

### What moves from IssuesList into TreemapInspector:
- All store selectors and actions
- Rule/file data transforms
- Auto-expand effect (selectedIssueId → expandRule + expandFileInRule)
- ResizeObserver effect
- Scroll-to-top effect
- RuleHeader config (severity change, option change, reset)
- Ignore system (addIgnore, removeIgnore, toggleShowIgnored)
- Custom content renderer logic (duplicate-comparison, issue summary, full source)
- Helper functions (getRuleDescription, getRuleCategory, getRuleDocsUrl)

### What it does NOT keep:
- `renderZoomedContent` callback pattern — eliminated, everything is inline
- `TreemapGrid` component — eliminated, layout + rendering are inline
- `FileTreemap` sub-component — eliminated, inline with `layoutId`

### Tests:
- Root view: renders rule cells
- Ghost cells: rendered inside each rule cell at opacity 0
- Zoomed view: renders ContextStrip + Breadcrumbs + RuleHeader + file cells
- File cells have `layoutId` matching ghost cells
- Clicking rule → zoomed view
- Clicking back → root view
- Auto-expand from selectedIssueId
- Empty state
- File source view when file expanded
- Ignore system works

---

## Stream E: Integration + Cleanup

**Modified file: `Inspector/InspectorSidebar.tsx`**
- Replace `<IssuesList />` with `<TreemapInspector />`

**Modified file: `HierarchicalTiles/index.ts`**
- Export `ghostCellVariants`, `fileLayoutTransition`
- Keep `TreemapCell`, `ContextStrip`, `calculateTreemapLayout` exports (used by TreemapInspector)

**Removed/deprecated:**
- `TreemapGrid.tsx` — functionality absorbed into TreemapInspector
- `IssuesList.tsx` — functionality absorbed into TreemapInspector

**Keep `TreemapGrid.test.tsx` and `IssuesList.test.tsx`** tests or migrate them to `TreemapInspector.test.tsx`.

---

## File Summary

| Stream | File | Action |
|--------|------|--------|
| A | `Inspector/treemap-inspector-store.ts` | **New** — standalone Zustand store |
| A | `Inspector/treemap-inspector-store.test.ts` | **New** — store tests |
| B | `HierarchicalTiles/TreemapCell.tsx` | **Modify** — add ghost, layoutId |
| B | `HierarchicalTiles/TreemapCell.test.tsx` | **Modify** — ghost tests |
| C | `HierarchicalTiles/animations/treemap-animations.ts` | **Modify** — ghost variants |
| C | `HierarchicalTiles/animations/index.ts` | **Modify** — exports |
| D | `Inspector/TreemapInspector.tsx` | **New** — composite view |
| D | `Inspector/TreemapInspector.test.tsx` | **New** — view tests |
| E | `Inspector/InspectorSidebar.tsx` | **Modify** — swap IssuesList → TreemapInspector |
| E | `Inspector/IssuesList.tsx` | **Remove** (or keep as deprecated) |
| E | `HierarchicalTiles/TreemapGrid.tsx` | **Remove** (or keep for other consumers) |

---

## Risk Assessment

1. **layoutId across separate AnimatePresence blocks** — Well-established pattern. The popover.tsx in this codebase does exactly this. Low risk.

2. **Ghost cell count** — Typically 50-450 invisible divs. At opacity 0 with pointer-events-none, the browser skips paint. Negligible perf cost.

3. **Store sync** — Navigation stays in composed store. Treemap store only owns animation/layout state. No sync conflicts.

4. **External dispatchers (HeatmapOverlay, CommandPalette)** — They dispatch `expandRule`, `expandFileInRule`, `selectIssue` to composed store. TreemapInspector reads those same values. No changes needed.

5. **IssuesList removal** — All functionality moves to TreemapInspector. Tests migrate. InspectorSidebar swaps the import.
