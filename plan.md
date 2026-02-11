# Zoomable Treemap Inspector — Implementation Plan

## Overview

Replace the mosaic tile grid in the inspector panel with a **zoomable treemap** that provides stable spatial layout, unambiguous size-to-importance mapping, and smooth zoom-based navigation. The treemap fills its container, encodes issue count via area and severity via color, and navigates via zoom transitions rather than in-place expansion with reflow.

### Design Principles
- **Stable coordinates**: Cell positions are deterministic and don't change when siblings are interacted with
- **Zoom, don't expand**: Navigation is a camera move (scale + translate), not a list reflow
- **Context preservation**: Siblings compress into strips but remain visible and clickable
- **Efficient animations**: CSS transform-based zoom (~200ms, GPU-accelerated), no per-tile reflow

---

## Architecture

### New files to create

| File | Purpose |
|------|---------|
| `HierarchicalTiles/layout/treemap-layout.ts` | Pure squarified treemap algorithm |
| `HierarchicalTiles/layout/treemap-layout.test.ts` | Unit tests for treemap algorithm |
| `HierarchicalTiles/TreemapGrid.tsx` | Renders treemap cells with zoom transitions |
| `HierarchicalTiles/TreemapGrid.test.tsx` | Component tests for TreemapGrid |
| `HierarchicalTiles/TreemapCell.tsx` | Individual treemap cell (replaces Tile for treemap use) |
| `HierarchicalTiles/TreemapCell.test.tsx` | Component tests for TreemapCell |
| `HierarchicalTiles/ContextStrip.tsx` | Compressed sibling strip shown when zoomed |
| `HierarchicalTiles/ContextStrip.test.tsx` | Component tests for ContextStrip |
| `HierarchicalTiles/animations/treemap-animations.ts` | Zoom-specific animation config |

### Files to modify

| File | Change |
|------|--------|
| `HierarchicalTiles/layout/index.ts` | Export treemap layout functions and types |
| `HierarchicalTiles/index.ts` | Export new TreemapGrid, TreemapCell, ContextStrip |
| `Inspector/IssuesList.tsx` | Replace ExpandableTileGrid/TileGrid with TreemapGrid |
| `HierarchicalTiles/layout/types.ts` | Add TreemapLayoutResult, TreemapCell types |

### Files NOT changed (reused as-is)

- `Inspector/Breadcrumbs.tsx` — works as-is inside zoomed view
- `Inspector/RuleHeader.tsx` — works as-is inside zoomed view
- `Inspector/IssueSummaryView.tsx` — works as-is at zoom level 2
- `Inspector/FileSourceView.tsx` — works as-is at zoom level 2
- `Inspector/RuleConfig.tsx` — works as-is
- `Inspector/DuplicateIssueList.tsx` — works as-is
- `Inspector/InspectorSidebar.tsx` — no changes needed, it renders IssuesList
- `core/store/core-slice.ts` — existing expandedRuleId/expandedFilePath state suffices
- `Inspector/RuleNodeAdapter.tsx` — data transform is reused unchanged

---

## Implementation Steps

### Phase 1: Treemap Layout Algorithm (pure functions, no React)

**Can run in parallel with Phase 2.**

#### Step 1.1: Add treemap types to `layout/types.ts`

Add new interfaces alongside existing ones (no changes to existing types):

```typescript
/** Single cell in treemap layout */
export interface TreemapCellLayout {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Normalized area fraction (0-1) for color intensity */
  areaFraction: number;
}

/** Result of treemap layout calculation */
export interface TreemapLayoutResult {
  cells: Map<string, TreemapCellLayout>;
  totalWidth: number;
  totalHeight: number;
}

/** Configuration for treemap layout */
export interface TreemapLayoutConfig {
  /** Total width available */
  width: number;
  /** Total height available */
  height: number;
  /** Padding between cells in pixels (default: 2) */
  gap?: number;
  /** Minimum cell dimension before label is hidden (default: 40) */
  minLabelDimension?: number;
}
```

#### Step 1.2: Implement squarified treemap in `layout/treemap-layout.ts`

Pure function. The squarified treemap algorithm (Bruls, Huizing, van Wijk 2000):

```typescript
export interface TreemapItem {
  id: string;
  /** Value determining area (issue count) */
  value: number;
  /** Label for display */
  label?: string;
}

/**
 * Calculate squarified treemap layout.
 * Items are sorted by value descending internally.
 * Produces cells with aspect ratios close to 1:1.
 */
export function calculateTreemapLayout(
  items: TreemapItem[],
  config: TreemapLayoutConfig
): TreemapLayoutResult;
```

Algorithm outline:
1. Sort items by value descending
2. Normalize values so they sum to `width * height`
3. Use the squarify algorithm: greedily add items to a row, measuring worst aspect ratio; when adding another item would worsen the ratio, lay out the current row and start a new one
4. Each "row" is actually a strip (horizontal or vertical) sliced from the remaining rectangle
5. Apply gap by insetting each cell by `gap/2` on each side

Properties to maintain:
- Deterministic output for same input (stable coordinates)
- Items with value 0 get no cell (filtered out)
- Single item fills the entire rectangle
- Two items split the rectangle along the longer axis

#### Step 1.3: Tests for `layout/treemap-layout.test.ts`

Test cases (follow patterns from existing `expanded-layout.test.ts` and `mosaic-layout.test.ts`):

- **Empty input**: Returns empty map, correct dimensions
- **Single item**: Cell fills entire rectangle
- **Two items**: Areas proportional to values, no overlap
- **Multiple items**: All cells within bounds, no overlaps, areas proportional
- **Aspect ratios**: All cells have aspect ratio < 3:1 (squarified guarantee)
- **Deterministic**: Same input produces identical output
- **Gap handling**: Cells have correct gap spacing
- **Zero-value items**: Filtered out gracefully
- **Equal values**: All cells have equal area
- **Extreme ratios**: Very tall container, very wide container
- **Large dataset**: 50+ items, still no overlaps

#### Step 1.4: Export from `layout/index.ts`

Add exports for treemap functions and types.

---

### Phase 2: Animation System (no React dependency)

**Can run in parallel with Phase 1.**

#### Step 2.1: Create `animations/treemap-animations.ts`

Define zoom transition configurations:

```typescript
import type { Transition, Variants } from "motion/react";
import { crispEase } from "./expansion-animations";

/** Duration for zoom transitions - quick enough to feel responsive */
export const ZOOM_DURATION = 0.25;

/** Duration for cell content fade */
export const CELL_CONTENT_DURATION = 0.15;

/** Stagger delay for cells appearing after zoom */
export const CELL_STAGGER = 0.02;

/** Zoom transition - used for the container transform */
export const zoomTransition: Transition = {
  duration: ZOOM_DURATION,
  ease: crispEase,
};

/** Cell appearance variants (used when entering a zoom level) */
export const cellVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

/** Context strip variants (siblings compressing) */
export const contextStripVariants: Variants = {
  hidden: { opacity: 0, height: 0 },
  visible: { opacity: 1, height: "auto" },
  exit: { opacity: 0, height: 0 },
};

/** Zoomed content variants (content appearing inside zoomed cell) */
export const zoomedContentVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      delay: ZOOM_DURATION * 0.6, // start after zoom is mostly done
      duration: CELL_CONTENT_DURATION,
      ease: crispEase,
    },
  },
  exit: { opacity: 0, y: 8 },
};
```

#### Step 2.2: Export from `animations/index.ts`

Add re-exports of the new treemap animations.

---

### Phase 3: TreemapCell Component

**Depends on Phase 1 types being defined.**

#### Step 3.1: Implement `TreemapCell.tsx`

A simpler component than `Tile.tsx`. Each cell is a colored rectangle with:
- Background color tinted by severity (using existing CSS variables: `--uilint-error`, `--uilint-warning`, `--uilint-info`)
- Opacity/saturation scaled by `areaFraction` for intensity
- Label text (rule name or file name) — hidden if cell is below `minLabelDimension`
- Issue count in bottom-left corner
- Hover: subtle brightness increase + pointer cursor
- Click: triggers zoom

```typescript
export interface TreemapCellProps {
  id: string;
  label: string;
  subtitle?: string;
  count: number;
  fileCount?: number;
  /** Severity mix for color tinting */
  severityCounts?: { error: number; warning: number; info: number };
  /** Cell dimensions (absolute positioned) */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Whether this cell is the currently zoomed one */
  isZoomed: boolean;
  /** Whether this cell is a compressed sibling */
  isCompressed: boolean;
  onClick: () => void;
  className?: string;
}
```

Color logic:
- Dominant severity determines hue (error=red, warning=amber, info=blue)
- Mix ratio determines saturation
- Use CSS variables from globals.css: `bg-error/10`, `bg-warning/10`, `bg-info/10`
- Higher issue count → higher opacity (range: 8% to 20% background opacity)

Size-adaptive content:
- Width > 120px AND height > 80px: Show label + count + fileCount
- Width > 60px AND height > 50px: Show truncated label + count
- Below that: Show colored rectangle only (tooltip on hover)

#### Step 3.2: Tests for `TreemapCell.test.tsx`

- Renders label and count
- Applies severity-based color class
- Hides label when dimensions are small
- Calls onClick on click
- Shows tooltip on hover for small cells
- Renders subtitle when present
- Applies isZoomed/isCompressed visual states

---

### Phase 4: ContextStrip Component

**Can run in parallel with Phase 3.**

#### Step 4.1: Implement `ContextStrip.tsx`

A horizontal strip of compressed sibling cells shown when zoomed in. Each item is a small colored rectangle (proportional width, fixed height) with a truncated label.

```typescript
export interface ContextStripItem {
  id: string;
  label: string;
  count: number;
  severityCounts?: { error: number; warning: number; info: number };
  /** Whether this is the currently active/zoomed item */
  isActive: boolean;
}

export interface ContextStripProps {
  items: ContextStripItem[];
  onItemClick: (id: string) => void;
  className?: string;
}
```

Layout:
- Fixed height: 28px
- Each item width proportional to its count relative to total
- Minimum width: 32px (for clickability)
- Active item has a highlight border/ring
- Items show truncated label if width > 48px, otherwise just colored block
- Horizontal scroll if items overflow

#### Step 4.2: Tests for `ContextStrip.test.tsx`

- Renders all items
- Proportional widths
- Active item highlighted
- Click handler fires with correct id
- Truncates labels on narrow items
- Minimum width enforced

---

### Phase 5: TreemapGrid Component (main orchestrator)

**Depends on Phases 1-4.**

#### Step 5.1: Implement `TreemapGrid.tsx`

The main component that replaces `ExpandableTileGrid`. Manages zoom state and renders cells with transitions.

```typescript
export interface TreemapGridProps<T extends BaseTileItem> {
  /** Root-level items (rules) */
  items: T[];
  /** ID of the zoomed item, or null */
  zoomedId: string | null;
  /** Children to show inside the zoomed item */
  zoomedChildren: T[];
  /** Available width */
  availableWidth: number;
  /** Available height (important for treemap — needs both dimensions) */
  availableHeight: number;
  /** Callback when a root cell is clicked */
  onCellClick: (item: T) => void;
  /** Callback when a child cell is clicked */
  onChildClick: (item: T) => void;
  /** Callback when back/zoom-out is triggered */
  onBack: () => void;
  /** Custom render for zoomed content (replaces default child treemap) */
  renderZoomedContent?: (
    item: T,
    children: T[],
    availableWidth: number,
    availableHeight: number
  ) => React.ReactNode;
}
```

**Rendering logic (three states):**

**State A — No zoom (zoomedId is null):**
- Calculate treemap layout for `items`
- Render each cell as `TreemapCell` at absolute position
- Staggered fade-in on mount

**State B — Zoomed to a rule (zoomedId set, no file expanded):**
- Render `ContextStrip` at top with all root items, active = zoomedId
- Below the strip, render zoomed content area:
  - If `renderZoomedContent` is provided, use it (IssuesList will use this)
  - Otherwise, calculate child treemap and render child `TreemapCell`s
- Animate: root treemap fades out while strip + content fades in (crossfade, ~200ms)

**State C — Zoomed to a file (handled by renderZoomedContent):**
- The ContextStrip shows rules at top
- Below it, renderZoomedContent handles file-level display with its own strip for files

**Height management:**
- The treemap needs a height. Use `availableHeight` which comes from the inspector panel's content area height. Add a `useResizeObserver` (or existing mechanism) to measure the scroll container.

**Zoom animation approach:**
- Use `AnimatePresence` with `mode="wait"` for crossfade between zoom levels
- Root treemap exits with `{ opacity: 0, scale: 0.95 }` (150ms)
- Zoomed content enters with `{ opacity: 0, scale: 1.02 }` → `{ opacity: 1, scale: 1 }` (200ms)
- The ContextStrip slides in from top with `{ opacity: 0, height: 0 }` → `{ opacity: 1, height: "auto" }` (200ms)
- Combined feel: user clicks a cell → it briefly brightens → view crossfades to zoomed content with the strip appearing at top — total perceived transition ~250ms

#### Step 5.2: Tests for `TreemapGrid.test.tsx`

- Renders cells for all items when no zoom
- Shows ContextStrip when zoomed
- Calls onCellClick with correct item
- Calls onChildClick with correct item
- Calls onBack when strip item is clicked (back to root)
- Renders custom renderZoomedContent when provided
- Handles empty items (empty state)
- Handles single item
- AnimatePresence crossfade works (mock motion/react)

---

### Phase 6: Wire up IssuesList

**Depends on Phase 5.**

#### Step 6.1: Modify `Inspector/IssuesList.tsx`

Replace the `ExpandableTileGrid` usage with `TreemapGrid`. The core change is in the JSX return — the data flow, callbacks, and all the existing RuleHeader/Breadcrumbs/FileSourceView rendering remains.

Key changes:
1. Import `TreemapGrid` instead of `ExpandableTileGrid` and `TileGrid`
2. Add `availableHeight` — measure the scroll container height using a ref + `useLayoutEffect` or `ResizeObserver`
3. Replace the `<ExpandableTileGrid>` JSX with `<TreemapGrid>`
4. Adapt `renderExpandedRuleContent` → `renderZoomedContent`:
   - When no file is expanded: render a child treemap (TreemapGrid handles this) or a custom list
   - When a file is expanded: render Breadcrumbs + RuleHeader + IssueSummaryView/FileSourceView (same as current)
5. The ContextStrip replaces the displaced siblings — root rules are always visible at top when zoomed

**What stays the same in IssuesList:**
- All store selectors (expandedRuleId, expandedFilePath, etc.)
- All callbacks (expandRule, collapseRule, expandFileInRule, etc.)
- RuleHeader with config popover
- Breadcrumbs
- IssueSummaryView / FileSourceView / DuplicateIssueList
- Auto-expand from heatmap click
- Ignore system

The `renderZoomedContent` callback will contain the same rule-detail rendering logic currently in `renderExpandedRuleContent`, but instead of being inside an expanded tile, it fills the main area below the ContextStrip.

#### Step 6.2: Update barrel exports

Update `HierarchicalTiles/index.ts` and `layout/index.ts` to export all new components and functions.

---

### Phase 7: Integration Tests and Polish

#### Step 7.1: End-to-end flow tests

Add tests to `IssuesList.test.tsx` (or create if not existing):
- Root view renders treemap cells for rules
- Clicking a rule cell triggers expandRule
- Zoomed view shows ContextStrip + rule content
- Clicking a file in zoomed view triggers expandFileInRule
- ContextStrip click navigates between rules
- Breadcrumb back returns to root
- Auto-expand from selectedIssueId works with treemap

#### Step 7.2: Run full test suite, lint, typecheck

```bash
pnpm --filter uilint-react test -- --run
pnpm --filter uilint-react lint:strict
pnpm --filter uilint-react typecheck
```

Fix any issues.

#### Step 7.3: Visual polish pass

- Verify severity colors look correct in light and dark mode
- Ensure ContextStrip proportions feel right
- Tune animation timings if crossfade feels too slow/fast
- Verify keyboard accessibility (tab through cells, Enter to zoom, Escape to zoom out)

---

## Parallelism Map

```
Phase 1 (treemap algorithm) ──────────┐
                                       ├──→ Phase 3 (TreemapCell) ──┐
Phase 2 (animations) ─────────────────┘                             │
                                                                     ├──→ Phase 5 (TreemapGrid) ──→ Phase 6 (IssuesList) ──→ Phase 7 (integration)
Phase 4 (ContextStrip) ─────────────────────────────────────────────┘
```

- **Phase 1 + Phase 2 + Phase 4**: All run in parallel (no dependencies)
- **Phase 3**: Needs Phase 1 types
- **Phase 5**: Needs Phases 1-4
- **Phase 6**: Needs Phase 5
- **Phase 7**: Needs Phase 6

---

## Animation Summary

| Action | Animation | Duration | Easing |
|--------|-----------|----------|--------|
| Initial treemap appear | Staggered cell fade-in | 150ms + 20ms stagger | crispEase |
| Cell hover | Brightness + slight border | 100ms | ease-out |
| Cell click (zoom in) | Cell brightens → crossfade to zoomed view | 250ms total | crispEase |
| ContextStrip appear | Slide down + fade in | 200ms | crispEase |
| Zoomed content appear | Fade in + slight upward | 150ms, delayed 100ms | crispEase |
| Zoom out (back) | Reverse crossfade | 200ms | crispEase |
| ContextStrip item click | Quick crossfade between rules | 200ms | crispEase |

All animations use `crispEase = [0.32, 0.72, 0, 1]` for consistency with the existing system.

---

## Files Checklist

### New files (9)
- [ ] `HierarchicalTiles/layout/treemap-layout.ts`
- [ ] `HierarchicalTiles/layout/treemap-layout.test.ts`
- [ ] `HierarchicalTiles/TreemapGrid.tsx`
- [ ] `HierarchicalTiles/TreemapGrid.test.tsx`
- [ ] `HierarchicalTiles/TreemapCell.tsx`
- [ ] `HierarchicalTiles/TreemapCell.test.tsx`
- [ ] `HierarchicalTiles/ContextStrip.tsx`
- [ ] `HierarchicalTiles/ContextStrip.test.tsx`
- [ ] `HierarchicalTiles/animations/treemap-animations.ts`

### Modified files (3)
- [ ] `HierarchicalTiles/layout/types.ts` — add treemap types
- [ ] `HierarchicalTiles/layout/index.ts` — add treemap exports
- [ ] `HierarchicalTiles/index.ts` — add component exports
- [ ] `Inspector/IssuesList.tsx` — swap to TreemapGrid

### Untouched files (reused)
- `Inspector/Breadcrumbs.tsx`
- `Inspector/RuleHeader.tsx`
- `Inspector/RuleConfig.tsx`
- `Inspector/IssueSummaryView.tsx`
- `Inspector/FileSourceView.tsx`
- `Inspector/DuplicateIssueList.tsx`
- `Inspector/InspectorSidebar.tsx`
- `Inspector/RuleNodeAdapter.tsx`
- `core/store/core-slice.ts`
- `core/store/composed-store.ts`
- `HierarchicalTiles/animations/expansion-animations.ts`
