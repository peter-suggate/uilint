# Plan: Spatial Layout Animation — Ghost File Cells

## The Idea

When the root treemap shows rules, **pre-render each rule's file cells inside it at opacity 0** ("ghost cells"). When the user clicks a rule, those invisible file cells animate smoothly to their full-size positions in the zoomed file treemap using Framer Motion's `layoutId`.

This eliminates the current crossfade and creates a continuous spatial transition where files visually "expand out" of their parent rule.

---

## Current Architecture (what we're changing)

- `AnimatePresence mode="wait"` swaps root view → zoomed view with a crossfade
- Root view and zoomed view are **never mounted simultaneously** (`mode="wait"` unmounts first, mounts second)
- File data is only computed for the expanded rule
- No `layoutId` on TreemapCell

## Target Architecture

- `AnimatePresence` without `mode="wait"` allows **both views to overlap** during transition
- Each rule cell contains ghost file cells with `layoutId={`treemap-file-${fileId}`}`
- Zoomed file cells have **matching `layoutId`** — Framer Motion auto-animates position/size/opacity
- Non-clicked rule cells fade out; clicked rule cell's background dissolves
- ContextStrip slides in simultaneously

---

## Phase 1: Pre-compute file children for all rules

**File: `IssuesList.tsx`**

Currently file nodes are only computed for the expanded rule:
```tsx
const fileNodes = useMemo(
  () => (expandedRule ? getFileNodesForRule(expandedRule) : []),
  [expandedRule]
);
```

Add: compute a `Map<ruleId, BaseTileItem[]>` for **all** rules so ghost cells can render inside every rule cell.

```tsx
const allFileItemsByRule = useMemo(() => {
  const map = new Map<string, BaseTileItem[]>();
  for (const rule of ruleNodes) {
    map.set(rule.id, getFileNodesForRule(rule).map(fileNodeToTileItem));
  }
  return map;
}, [ruleNodes]);
```

Pass as new prop to TreemapGrid: `childrenByItem={allFileItemsByRule}`

**Cost**: Typically 10-30 rules × 5-15 files each = 50-450 items. Negligible.

---

## Phase 2: Add `layoutId` and `ghost` support to TreemapCell

**File: `TreemapCell.tsx`**

Add optional props:

```tsx
export interface TreemapCellProps {
  // ... existing props ...
  /** Framer Motion layoutId for cross-view spatial animations */
  layoutId?: string;
  /** Whether this is a ghost cell (invisible, no interactions, no content) */
  ghost?: boolean;
}
```

When `ghost=true`:
- Render with `opacity: 0` (not `visibility:hidden` — Framer Motion needs to track the element)
- Add `pointer-events-none`
- Skip hover/tap animations (`whileHover`, `whileTap` = undefined)
- Skip all content rendering (just mount the `motion.div` shell)
- Use `ghostCellVariants` (always opacity 0) instead of standard variants

When `layoutId` is set:
- Pass to `motion.div` as `layoutId={layoutId}`

---

## Phase 3: Ghost cell layer in TreemapGrid

**File: `TreemapGrid.tsx`**

### 3a. New prop

```tsx
export interface TreemapGridProps<T extends BaseTileItem> {
  // ... existing props ...
  /** Pre-computed children for all items, for ghost cell pre-rendering */
  childrenByItem?: Map<string, T[]>;
}
```

### 3b. Compute ghost layouts

For each root cell that has children, calculate a mini treemap layout within the cell's bounds:

```tsx
const ghostLayouts = useMemo(() => {
  if (!childrenByItem) return null;
  const map = new Map<string, TreemapLayoutResult>();
  for (const item of items) {
    const children = childrenByItem.get(item.id);
    const cell = rootLayout.cells.get(item.id);
    if (!children?.length || !cell) continue;
    map.set(item.id, calculateTreemapLayout(
      toTreemapItems(children),
      { width: cell.width, height: cell.height, gap: 1 }
    ));
  }
  return map;
}, [childrenByItem, items, rootLayout]);
```

### 3c. Render ghost cells as siblings (not children) of root cells

**Critical**: Ghost cells must be at the **same DOM level** as the zoomed file cells for `layoutId` handoff to work. They cannot be nested inside the root `motion.div` that will exit, because exiting parents would interfere with the layout animation.

New DOM structure:

```tsx
<LayoutGroup>
  <div className="relative" style={{ width, height }}>
    {/* Layer 1: Root rule cells — exit on zoom */}
    <AnimatePresence>
      {!zoomedId && (
        <motion.div key="root" exit={{ opacity: 0 }} ...>
          {items.map(item => <TreemapCell ... />)}
        </motion.div>
      )}
    </AnimatePresence>

    {/* Layer 2: Ghost file cells — always present when root is shown */}
    {/* Positioned absolutely, offset by parent cell position */}
    <AnimatePresence>
      {!zoomedId && items.map(item => {
        const ghostLayout = ghostLayouts?.get(item.id);
        const parentCell = rootLayout.cells.get(item.id);
        if (!ghostLayout || !parentCell) return null;
        const children = childrenByItem?.get(item.id) ?? [];
        return children.map(child => {
          const gc = ghostLayout.cells.get(child.id);
          if (!gc) return null;
          return (
            <TreemapCell
              key={`ghost-${child.id}`}
              layoutId={`treemap-file-${child.id}`}
              ghost={true}
              x={parentCell.x + gc.x}
              y={parentCell.y + gc.y}
              width={gc.width}
              height={gc.height}
              ...
            />
          );
        });
      })}
    </AnimatePresence>

    {/* Layer 3: Zoomed view */}
    <AnimatePresence>
      {zoomedId && zoomedItem && (
        <motion.div key={`zoomed-${zoomedId}`} ...>
          <ContextStrip ... />
          {/* Content with file cells that have matching layoutId */}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
</LayoutGroup>
```

### 3d. Remove `mode="wait"` and split into separate AnimatePresence blocks

Using separate `<AnimatePresence>` for each layer (instead of a single one with `mode="wait"`) lets:
1. Root cells exit independently
2. Ghost cells exit (triggering `layoutId` handoff)
3. Zoomed view enters (receiving `layoutId` animation from ghost positions)

All three animations happen concurrently for a seamless spatial transition.

---

## Phase 4: Matching layoutIds in zoomed file cells

**File: `IssuesList.tsx` — `FileTreemap` component**

Add `layoutId` to each file cell in the zoomed view:

```tsx
<TreemapCell
  key={item.id}
  layoutId={`treemap-file-${item.id}`}  // Matches ghost cell
  id={item.id}
  ...
/>
```

When Framer Motion detects the ghost cell (`opacity: 0`, small, at parent-cell position) exiting and a matching `layoutId` cell entering at full size, it **automatically interpolates position, width, height, and opacity** — creating the smooth expansion animation.

---

## Phase 5: Animation system updates

**File: `treemap-animations.ts`**

### 5a. New ghost cell variants

```tsx
export const ghostCellVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 0 },    // Always invisible
  exit: { opacity: 0 },       // Exit triggers layoutId handoff
};
```

### 5b. Layout transition for file cells

```tsx
export const fileLayoutTransition: Transition = {
  duration: ZOOM_DURATION,
  ease: crispEase,
};
```

### 5c. Faster root exit (concurrent with file cell expansion)

```tsx
export const rootTreemapVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },    // Less dramatic since file cells animate separately
};
```

---

## Phase 6: Reverse animation (zoom out)

When the user navigates back:
1. Zoomed file cells exit (with their `layoutId`)
2. Ghost cells re-enter (receiving `layoutId` animation back to mini positions inside rule cells)
3. Root rule cells fade in

This is **automatic** with Framer Motion's `layoutId` — the reverse animation is computed from the same `layoutId` matching.

---

## Phase 7: Update tests

### TreemapCell.test.tsx
- Test `ghost=true`: opacity 0, no content rendered, pointer-events-none class present
- Test `layoutId` prop: verify the motion.div receives it
- Update mock to strip `layoutId` prop

### TreemapGrid.test.tsx
- Test that ghost cells render with `data-treemap-cell` when `childrenByItem` is provided
- Test ghost cells are not rendered when `childrenByItem` is undefined
- Test ghost cells are positioned within parent cell bounds
- Test separate AnimatePresence blocks exist

### IssuesList.test.tsx
- Test `allFileItemsByRule` is passed as `childrenByItem`
- Existing tests continue to pass

### treemap-animations.ts
- Test `ghostCellVariants` has opacity 0 for all states
- Test `fileLayoutTransition` configuration

---

## File Change Summary

| File | Changes |
|------|---------|
| `TreemapCell.tsx` | Add `layoutId`, `ghost` props; conditional rendering for ghosts |
| `TreemapGrid.tsx` | Add `childrenByItem` prop; render ghost layer; split AnimatePresence; add LayoutGroup |
| `treemap-animations.ts` | Add `ghostCellVariants`, `fileLayoutTransition`; tune exit animations |
| `IssuesList.tsx` | Compute `allFileItemsByRule`; pass `childrenByItem`; add `layoutId` to FileTreemap cells |
| `TreemapCell.test.tsx` | Tests for ghost/layoutId behavior |
| `TreemapGrid.test.tsx` | Tests for ghost cell rendering |

---

## Risk Assessment

1. **layoutId across AnimatePresence**: Well-established pattern in this codebase (popover.tsx, ExpandableContainer.tsx, ExpandableTile.tsx, ResultList.tsx). Low risk.

2. **Performance of ghost cells**: ~50-450 invisible divs with `pointer-events-none`. No paint cost at opacity 0. Negligible.

3. **Layout computation for all rules**: `calculateTreemapLayout` runs once per rule. The squarify algorithm is O(n log n) per call. With ~5-15 files per rule, this is microseconds each.

4. **Separate AnimatePresence blocks**: Allows concurrent entry/exit across layers. This is the standard pattern for overlapping layout animations — same approach used in ExpandableContainer/ExpandableTileGrid.

5. **Zoom-out reverse**: `layoutId` handles this automatically. Ghost cells re-mount → Framer Motion animates file cells from zoomed size back to ghost (mini) positions.
