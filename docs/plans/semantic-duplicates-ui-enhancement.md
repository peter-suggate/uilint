# Semantic Duplicates UI Enhancement Plan

## Overview

This document outlines a comprehensive plan to enhance the UI for the `no-semantic-duplicates` ESLint rule. The goal is to provide an intuitive comparison view in the inspector and filter the heat map overlay to show only relevant elements when an issue is selected.

**Layout Constraint**: The inspector sidebar is narrow (320-800px width) but has abundant vertical height. Layout designs must optimize for vertical space rather than horizontal.

## Current State

### ESLint Rule (`no-semantic-duplicates.ts`)
- Reports similarity between code chunks with: `kind`, `name`, `similarity`, `otherName`, `otherLocation`
- Has `customInspector: "duplicates"` in metadata (prepared for custom inspector)
- Does **not** include actual source code in the report

### Semantic Plugin (`plugins/semantic/index.ts`)
- Has `ruleContributions` for `no-semantic-duplicates` with commented-out `inspectorPanel`
- Handles WebSocket messages for duplicates indexing status

### Inspector System
- `SourceViewer` component shows code with line highlighting
- `InspectorPanel` interface supports custom React components per rule
- `RuleUIContribution.inspectorPanel` enables per-rule custom panels

### Heat Map Overlay (`HeatmapOverlay.tsx`)
- Shows all issues from `plugins.eslint.issues`
- No filtering mechanism for selected issues
- Uses `data-loc` attribute for element matching

## Proposed Changes

### Phase 1: Extend ESLint Rule Reporting (Server-side)
**Goal**: Include source and target code snippets in the ESLint report

#### 1.1 Add Code Extraction to Rule
- **File**: `packages/uilint-eslint/src/rules/no-semantic-duplicates.ts`
- **Changes**:
  - Add helper function to read code from file at specific line range
  - Include `sourceCode`, `targetCode`, `sourceLocation`, `targetLocation` in report data
  - Add `startColumn`/`endColumn` for precise highlighting

```typescript
// New data structure in context.report()
data: {
  kind: string,
  name: string,
  similarity: string,
  otherName: string,
  otherLocation: string,
  // NEW: Extended data for inspector
  sourceCode: string,      // Code snippet of current chunk
  targetCode: string,      // Code snippet of similar chunk
  sourceLocation: {
    filePath: string,
    startLine: number,
    endLine: number,
    startColumn: number,
    endColumn: number,
  },
  targetLocation: {
    filePath: string,
    startLine: number,
    endLine: number,
    startColumn: number,
    endColumn: number,
  },
}
```

#### 1.2 Add Tests for Extended Reporting
- **File**: `packages/uilint-eslint/src/rules/no-semantic-duplicates.test.ts`
- **Tests**:
  - Verify `sourceCode` and `targetCode` are included in report
  - Verify location data is accurate
  - Test edge cases (long code, special characters)

---

### Phase 2: Create Duplicates Inspector Panel (Client-side)
**Goal**: Intuitive comparison view optimized for vertical inspector layout

#### 2.0 Layout Options Analysis

Given the narrow width (320-800px) and tall height of the inspector, we have several layout options:

| Layout | Pros | Cons |
|--------|------|------|
| **Stacked (Recommended)** | Full width for code, easy scanning, natural scroll | Requires scrolling to compare |
| **Tabbed** | Minimal space, clean UI | Can't see both at once |
| **Accordion** | Compact, user-controlled | Extra clicks to expand |
| **Unified Diff** | Familiar to devs, compact | Complex for non-identical code |
| **Mini-map + Detail** | Quick overview | Implementation complexity |

**Recommended: Stacked Layout with Smart Enhancements**

```
┌─────────────────────────────────┐
│ ⚠ 87% Similar                   │  <- Similarity header
├─────────────────────────────────┤
│ 📍 This Code                    │  <- Section label
│ src/Button.tsx:15-28            │  <- File path + lines
│ ┌─────────────────────────────┐ │
│ │ 15 │ function Button() {    │ │  <- Code block (collapsible)
│ │ 16 │   const [x, setX] =... │ │
│ │ .. │ ...                    │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ 🔗 Similar Code                 │  <- Section label
│ src/IconButton.tsx:22-35        │  <- Clickable to navigate
│ ┌─────────────────────────────┐ │
│ │ 22 │ function IconButton(){ │ │  <- Code block (collapsible)
│ │ 23 │   const [x, setX] =... │ │
│ │ .. │ ...                    │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ [Show in Heatmap] [Go to File]  │  <- Action buttons
└─────────────────────────────────┘
```

**Smart Enhancements**:
1. **Sticky similarity header** - Always visible when scrolling
2. **Collapsible sections** - Expand/collapse each code block
3. **Scroll sync indicator** - Optional line-to-line linking
4. **Jump to similar** - Button to scroll between sections

#### 2.1 Create DuplicatesInspectorPanel Component
- **File**: `packages/uilint-react/src/plugins/semantic/panels/DuplicatesInspectorPanel.tsx`
- **Features**:
  - Stacked vertical layout (source above, target below)
  - Sticky similarity score header with color-coded badge
  - Collapsible code sections (default: both expanded)
  - File path headers with "Go to file" action
  - Syntax-highlighted code using existing `SourceViewer` pattern
  - Action bar with "Show in Heatmap" and navigation buttons

```tsx
interface DuplicatesInspectorPanelProps {
  data?: {
    issue: Issue & {
      sourceCode?: string;
      targetCode?: string;
      sourceLocation?: LocationData;
      targetLocation?: LocationData;
      similarity?: number;
    };
  };
}
```

#### 2.2 Create CollapsibleCodeSection Sub-component
- **File**: `packages/uilint-react/src/plugins/semantic/panels/CollapsibleCodeSection.tsx`
- **Features**:
  - Reusable collapsible code block with header
  - Section label ("This Code" / "Similar Code") with icon
  - File path + line range as clickable link
  - Expand/collapse toggle (chevron icon)
  - Line number gutter
  - Highlighted target line within the block
  - "Go to file" action in header

#### 2.3 Create DuplicateSimilarityBadge Component
- **File**: `packages/uilint-react/src/plugins/semantic/panels/DuplicateSimilarityBadge.tsx`
- **Features**:
  - Visual percentage indicator (color-coded)
  - 85-100%: Red (high similarity)
  - 70-85%: Orange (moderate similarity)
  - <70%: Yellow (lower similarity)

#### 2.4 Register Inspector Panel in Semantic Plugin
- **File**: `packages/uilint-react/src/plugins/semantic/index.ts`
- **Changes**:
  - Import `DuplicatesInspectorPanel`
  - Add to `inspectorPanels` array
  - Update `ruleContributions` to reference the panel

```typescript
ruleContributions: [
  {
    ruleId: "no-semantic-duplicates",
    inspectorPanel: DuplicatesInspectorPanel,  // <-- Enable this
    heatmapColor: "#f59e0b",
  },
],
```

#### 2.5 Add Tests for Inspector Panel
- **File**: `packages/uilint-react/src/plugins/semantic/panels/DuplicatesInspectorPanel.test.tsx`
- **Tests**:
  - Renders source and target code in stacked layout
  - Displays correct file paths and line numbers
  - Shows similarity percentage with correct color coding
  - Handles missing data gracefully (loading state, error state)
  - Collapsible sections expand/collapse correctly
  - "Show in Heatmap" button triggers filter
  - "Go to file" action navigates correctly

---

### Phase 3: Heat Map Filtering for Selected Issues
**Goal**: When a duplicate issue is selected, show only relevant elements

#### 3.1 Add Heat Map Filter State
- **File**: `packages/uilint-react/src/core/store/core-slice.ts`
- **Changes**:
  - Add `heatmapFilter: { dataLocs: Set<string> | null }` to state
  - Add `setHeatmapFilter(dataLocs: string[] | null)` action
  - `null` means show all, `Set<string>` means show only matching

```typescript
// New state properties
heatmapFilter: {
  mode: 'all' | 'selected',
  dataLocs: Set<string> | null,
  relatedDataLocs: Set<string> | null,  // For showing both source + target
}
```

#### 3.2 Update HeatmapOverlay to Support Filtering
- **File**: `packages/uilint-react/src/ui/components/HeatmapOverlay.tsx`
- **Changes**:
  - Read `heatmapFilter` from store
  - Filter `elementRects` based on filter state
  - Add visual distinction for "related" elements (e.g., dashed border for target)

```tsx
// Filter logic
const filteredRects = useMemo(() => {
  if (!heatmapFilter || heatmapFilter.mode === 'all') {
    return elementRects;
  }
  return new Map(
    Array.from(elementRects.entries()).filter(([dataLoc]) =>
      heatmapFilter.dataLocs?.has(dataLoc) ||
      heatmapFilter.relatedDataLocs?.has(dataLoc)
    )
  );
}, [elementRects, heatmapFilter]);
```

#### 3.3 Update Inspector to Set Heat Map Filter
- **File**: `packages/uilint-react/src/ui/components/Inspector/IssueDetail.tsx`
- **Changes**:
  - When displaying a `no-semantic-duplicates` issue, set heat map filter
  - Include both source and target `dataLoc` values
  - Clear filter when inspector closes or issue changes

#### 3.4 Add "Show All" / "Show Related" Toggle
- **File**: `packages/uilint-react/src/plugins/semantic/panels/DuplicatesInspectorPanel.tsx`
- **Features**:
  - Toggle button to switch between "Show All Issues" and "Show Related Only"
  - Persists preference in local storage

#### 3.5 Add Tests for Heat Map Filtering
- **File**: `packages/uilint-react/src/ui/components/HeatmapOverlay.test.tsx`
- **Tests**:
  - All issues shown when filter is null
  - Only matching dataLocs shown when filter is set
  - Related elements shown with distinct styling
  - Filter clears on inspector close

---

### Phase 4: WebSocket Integration for Source Code Fetching
**Goal**: Fetch source code on-demand if not included in report

#### 4.1 Add Source Code Request Message Type
- **File**: `packages/uilint-server/src/types.ts` (or equivalent)
- **Message**: `{ type: "source:request", filePath, startLine, endLine }`
- **Response**: `{ type: "source:response", filePath, startLine, endLine, code }`

#### 4.2 Add useSourceCode Hook Enhancement
- **File**: `packages/uilint-react/src/ui/hooks/useSourceCode.ts`
- **Changes**:
  - Support fetching code for multiple file ranges
  - Cache responses to avoid duplicate requests
  - Handle race conditions with request IDs

#### 4.3 Add Tests for Source Code Fetching
- **File**: `packages/uilint-react/src/ui/hooks/useSourceCode.test.ts`
- **Tests**:
  - Successfully fetches source code via WebSocket
  - Handles errors gracefully
  - Caches responses correctly
  - Cancels stale requests

---

## Task Parallelization Strategy

Tasks can be parallelized across these independent workstreams:

### Workstream A: ESLint Rule Extension (Phase 1)
- Can be done independently
- No dependencies on UI changes
- Backward compatible (new data is additive)

### Workstream B: Inspector Panel UI (Phase 2)
- Can start with mock data while waiting for Phase 1
- Components can be developed in isolation
- Tests can use fixtures

### Workstream C: Heat Map Filtering (Phase 3)
- State management independent of Phase 1/2
- HeatmapOverlay changes are self-contained
- Can be tested with mock filter state

### Workstream D: WebSocket Integration (Phase 4)
- Optional enhancement
- Can be skipped if code is included in report
- Fallback mechanism for large code

### Parallel Execution Plan

```
Week 1:
├── Developer 1: Phase 1 (ESLint rule) ─────────────────┐
├── Developer 2: Phase 2.1-2.3 (UI components) ─────────┤
└── Developer 3: Phase 3.1-3.2 (Heat map state/filter) ─┘

Week 2:
├── Developer 1: Phase 4 (WebSocket) ───────────────────┐
├── Developer 2: Phase 2.4-2.5 (Integration + tests) ───┤
└── Developer 3: Phase 3.3-3.5 (Integration + tests) ───┘

Week 3:
├── All: Integration testing and bug fixes
└── All: Documentation and cleanup
```

---

## File Changes Summary

### New Files
| File | Purpose |
|------|---------|
| `packages/uilint-react/src/plugins/semantic/panels/DuplicatesInspectorPanel.tsx` | Main inspector panel |
| `packages/uilint-react/src/plugins/semantic/panels/DuplicatesInspectorPanel.test.tsx` | Panel tests |
| `packages/uilint-react/src/plugins/semantic/panels/CollapsibleCodeSection.tsx` | Collapsible code block component |
| `packages/uilint-react/src/plugins/semantic/panels/DuplicateSimilarityBadge.tsx` | Similarity indicator |
| `packages/uilint-react/src/ui/components/HeatmapOverlay.test.tsx` | Heat map filter tests |

### Modified Files
| File | Changes |
|------|---------|
| `packages/uilint-eslint/src/rules/no-semantic-duplicates.ts` | Add code extraction |
| `packages/uilint-eslint/src/rules/no-semantic-duplicates.test.ts` | Test extended data |
| `packages/uilint-react/src/plugins/semantic/index.ts` | Register inspector panel |
| `packages/uilint-react/src/plugins/semantic/types.ts` | Add types for duplicates data |
| `packages/uilint-react/src/core/store/core-slice.ts` | Add heat map filter state |
| `packages/uilint-react/src/ui/components/HeatmapOverlay.tsx` | Add filtering logic |
| `packages/uilint-react/src/ui/components/Inspector/IssueDetail.tsx` | Set filter on issue select |

---

## Testing Strategy

### Unit Tests
- Each new component has co-located `.test.tsx` file
- Mock services using `test-utils.ts` patterns
- Test edge cases (missing data, errors, loading states)

### Integration Tests
- Test full flow: issue selected → inspector opens → heat map filters
- Test WebSocket communication mocking

### Visual Regression Tests (Optional)
- Snapshot tests for stacked code comparison view
- Test collapsible section states (expanded/collapsed)

### Manual Testing Checklist
- [ ] Select a semantic duplicate issue
- [ ] Verify stacked code layout renders correctly
- [ ] Verify both code sections are collapsible
- [ ] Verify similarity percentage displays with correct color
- [ ] Verify heat map shows only source + target elements
- [ ] Verify "Show in Heatmap" button works
- [ ] Verify "Go to file" navigation works
- [ ] Test with very long code snippets (scrolling)
- [ ] Test with many duplicate issues

---

## Success Criteria

1. **Stacked Code Comparison**: When a `no-semantic-duplicates` issue is selected, the inspector shows both source and target code in a clear, stacked vertical layout optimized for the narrow sidebar.

2. **Heat Map Focus**: The heat map overlay filters to show only the source element and target element, making it easy to locate both pieces of code on the page.

3. **Intuitive UX**: Users can immediately understand:
   - Which code is duplicated (labeled sections)
   - Where the duplicate is located (file paths + line numbers)
   - How similar the code is (color-coded percentage badge)

4. **Performance**: No noticeable lag when:
   - Opening the inspector
   - Filtering the heat map
   - Scrolling through code
   - Expanding/collapsing sections

5. **Test Coverage**: >80% coverage on new code with meaningful assertions.

---

## Open Questions

1. **Code Size Limit**: Should we limit the code snippet size in the report? Large files could bloat the ESLint output.
   - **Proposed**: Limit to 50 lines, show "..." with "View full file" link

2. **Multiple Duplicates**: What if a chunk has multiple similar matches?
   - **Proposed**: Show primary match in stacked view, add "N more similar" expandable list below

3. **Cross-File Navigation**: Should clicking on target location open that file?
   - **Proposed**: Yes, via existing file navigation mechanism (IDE integration)

4. **Default Collapse State**: Should sections start expanded or collapsed?
   - **Proposed**: Both expanded by default; remember user preference in localStorage

---

## Implementation Priority

1. **Must Have (MVP)**:
   - Phase 1: Extended reporting
   - Phase 2.1-2.4: Inspector panel
   - Phase 3.1-3.2: Basic heat map filtering

2. **Should Have**:
   - Phase 2.5: Full test coverage
   - Phase 3.3-3.5: Show All toggle + tests

3. **Nice to Have**:
   - Phase 4: WebSocket fallback for large code
   - Diff highlighting between similar code blocks
   - "Jump to similar" button to scroll between sections
