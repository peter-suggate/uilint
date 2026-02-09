# Design: Duplicate Code Comparison View & Ignore Functionality

## Problem Statement

The duplicate code detection plugin reports issues through the standard ESLint issue pipeline, which renders them using the generic `IssuesList` → `IssueSummaryView` → `FileSourceView` flow. This shows the code *where* the issue is reported but doesn't visually communicate *what* is duplicated. Users must mentally cross-reference two locations to understand the duplication, which is slow and error-prone.

Additionally, there is no mechanism to ignore or dismiss issues, forcing users to either fix every reported duplicate or disable the rule entirely.

## Goals

1. **Comparison view**: Show both code snippets side-by-side or stacked so users can instantly see what's duplicated
2. **Diff highlighting**: Visually distinguish matching vs. differing lines between the pair
3. **Ignore system**: Allow users to dismiss specific issue instances with persistence across sessions

---

## Part 1: Duplicate Code Comparison View

### Current Architecture

```
IssuesList
  └─ Rule tile ("no-duplicates")
       └─ File tile ("Button.tsx")
            └─ IssueSummaryView (list of issues with messages)
                 └─ FileSourceView (inline source with annotations)
```

Each duplicate issue carries rich metadata in `issue.metadata` (populated by the ESLint rule's `context.report` data):

```typescript
{
  sourceCode: string;          // Full source code of "this" chunk
  targetCode: string;          // Full code of the similar chunk
  sourceLocation: string;      // JSON: { filePath, startLine, endLine, startColumn, endColumn }
  targetLocation: string;      // JSON: same shape
  sourceName: string;          // Function/component name
  targetName: string;          // Similar function/component name
  similarityScore: string;     // Float 0-1
  similarity: string;          // Percentage (e.g. "85")
  kind: string;                // "component" | "hook" | "function"
}
```

### Proposed Architecture

```
IssuesList
  └─ Rule tile ("no-duplicates")
       └─ File tile ("Button.tsx")
            └─ DuplicateIssueList          ← NEW (replaces IssueSummaryView)
                 └─ DuplicateComparison    ← NEW (replaces FileSourceView)
```

### Integration Point: Rule-Specific Content Renderers

**Location**: `IssuesList.tsx` expanded content area (lines 400-443)

The `IssuesList` component currently has a three-way conditional:
1. `!isFileExpanded` → file tiles grid
2. `!showFullSource` → `IssueSummaryView`
3. else → `FileSourceView`

**Change**: Add a check for rule-specific content renderers before falling through to the generic views. The plugin registry already supports `getRuleContribution()` - extend it to support a `contentRenderer` property.

```typescript
// In IssuesList renderExpandedRuleContent:
const ruleContribution = pluginRegistry.getRuleContribution(expandedRuleId);

if (ruleContribution?.contentRenderer) {
  return ruleContribution.contentRenderer({ issues, selectedIssueId, ... });
}
// else fall through to existing IssueSummaryView / FileSourceView
```

The duplicates plugin would register:

```typescript
// In uilint-duplicates/src/plugin/index.ts
rules: [{
  ruleId: "no-duplicates",
  contentRenderer: "duplicate-comparison",  // declarative key
}]
```

And `uilint-react` would map `"duplicate-comparison"` to the `DuplicateIssueList` component.

### New Components

#### 1. `DuplicateIssueList`

**Path**: `packages/uilint-react/src/ui/components/Inspector/DuplicateIssueList.tsx`

Replaces `IssueSummaryView` for the `no-duplicates` rule. Shows a scrollable list of duplicate pairs detected in the expanded file.

```
┌──────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────┐ │
│  │ 🔗 85% similar                          │ │
│  │ UserCard ↔ ProfileCard                  │ │
│  │ src/components/ProfileCard.tsx:12        │ │
│  └──────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────┐ │
│  │ 🔗 78% similar                          │ │
│  │ useAuth ↔ useSession                    │ │
│  │ src/hooks/useSession.ts:5               │ │
│  └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

Each row is a compact card showing:
- Similarity percentage (color-coded: red ≥90%, orange ≥80%, yellow ≥70%)
- Source name ↔ Target name
- Target file location (since source is the currently expanded file)
- Click to expand into `DuplicateComparison`

**Props**:
```typescript
interface DuplicateIssueListProps {
  issues: Issue[];               // All no-duplicates issues for this file
  selectedIssueId: string | null;
  onIssueClick: (issue: Issue) => void;
  onIgnore: (issueId: string) => void;
}
```

#### 2. `DuplicateComparison`

**Path**: `packages/uilint-react/src/ui/components/Inspector/DuplicateComparison.tsx`

The main comparison view for a selected duplicate pair. Displayed when a user clicks a pair in `DuplicateIssueList`.

**Layout Options** (toggle via button):

**Stacked (default)** - works well in the sidebar's narrow width:
```
┌──────────────────────────────────────────────┐
│  85% similar  ·  component                   │
│  ┌─ Stacked ─┐  ┌─ Side by side ─┐          │
├──────────────────────────────────────────────┤
│  ▾ This Code: UserCard                       │
│  src/components/UserCard.tsx:15-42           │
│ ┌────────────────────────────────────────┐   │
│ │ 15 │ function UserCard({ user }) {     │   │
│ │ 16 │   const [expanded, setExpanded]   │   │
│ │  · │   = useState(false);              │   │
│ │ 17+│   const name = formatName(user);  │ ← │ unique line (highlighted)
│ │ 18 │   return (                        │   │
│ │ 19 │     <div className="card">        │   │
│ │ 20 │       <Avatar src={user.avatar} />│   │
│ │ 21+│       <h3>{name}</h3>             │ ← │ unique line
│ │  … │       ...                         │   │
│ │ 42 │ }                                 │   │
│ └────────────────────────────────────────┘   │
├──────────────────────────────────────────────┤
│  ▾ Similar Code: ProfileCard                 │
│  src/components/ProfileCard.tsx:12-38        │
│ ┌────────────────────────────────────────┐   │
│ │ 12 │ function ProfileCard({ profile }) │   │
│ │ 13 │   const [expanded, setExpanded]   │   │
│ │  · │   = useState(false);              │   │
│ │ 14+│   const label = profile.name;     │ ← │ unique line
│ │ 15 │   return (                        │   │
│ │ 16 │     <div className="card">        │   │
│ │ 17 │       <Avatar src={profile.img} />│   │
│ │ 18+│       <h3>{label}</h3>            │ ← │ unique line
│ │  … │       ...                         │   │
│ │ 38 │ }                                 │   │
│ └────────────────────────────────────────┘   │
├──────────────────────────────────────────────┤
│  [Open in Editor]  [Focus Heatmap]  [Ignore] │
└──────────────────────────────────────────────┘
```

**Side-by-side** - useful when inspector is wide or popped out:
```
┌──────────────────────────────────────────────────────────┐
│  85% similar  ·  component                               │
├────────────────────────────┬─────────────────────────────┤
│  UserCard                  │  ProfileCard                │
│  UserCard.tsx:15-42        │  ProfileCard.tsx:12-38      │
│ ┌────────────────────────┐ │ ┌─────────────────────────┐ │
│ │ 15 │ function UserCard │ │ │ 12 │ function ProfileCar│ │
│ │ 16 │   const [expanded │ │ │ 13 │   const [expanded  │ │
│ │ 17+│   const name = .. │ │ │ 14+│   const label = .. │ │
│ │ 18 │   return (        │ │ │ 15 │   return (         │ │
│ │  … │                   │ │ │  … │                    │ │
│ └────────────────────────┘ │ └─────────────────────────┘ │
├────────────────────────────┴─────────────────────────────┤
│  [Open in Editor]  [Focus Heatmap]  [Ignore]             │
└──────────────────────────────────────────────────────────┘
```

**Props**:
```typescript
interface DuplicateComparisonProps {
  issue: Issue;                // The selected duplicate issue
  mode: "stacked" | "side-by-side";
  onModeChange: (mode: "stacked" | "side-by-side") => void;
  onOpenInEditor: (location: CodeLocation) => void;
  onFocusHeatmap: () => void;
  onIgnore: () => void;
  isIgnored: boolean;
}
```

#### 3. `DiffCodeViewer`

**Path**: `packages/uilint-react/src/ui/components/Inspector/DiffCodeViewer.tsx`

A code viewer that understands diff highlighting. Takes two code blocks, computes a line-level diff, and highlights lines that differ.

**Diff Algorithm**: Use a simple LCS (Longest Common Subsequence) approach at the line level. Since we're comparing semantically similar code (not arbitrary text), line-level diffing is sufficient. No need for character-level diffs.

**Line Classifications**:
- **Common**: Line exists in both snippets (neutral background)
- **Modified**: Line exists at same position but differs (amber/yellow background)
- **Unique**: Line only exists in one snippet (light blue background)

```typescript
interface DiffCodeViewerProps {
  code: string;
  startLine: number;
  diffLines: DiffLine[];        // Pre-computed diff result
  maxHeight?: number;
  onLineClick?: (line: number) => void;
}

interface DiffLine {
  type: "common" | "modified" | "unique";
  lineNumber: number;
  content: string;
  correspondingLine?: number;   // Line in the other snippet
}
```

**Color Scheme** (using existing design tokens):
- Common lines: default `bg-transparent`
- Modified lines: `bg-warning-bg` with left border `border-l-warning`
- Unique lines: `bg-info-bg` with left border `border-l-info`
- A legend strip at the top of each code panel

### Data Flow

```
Issue.metadata
  ├─ sourceCode ──────────┐
  ├─ targetCode ──────────┤
  ├─ sourceLocation ──────┤──→ DuplicateComparison
  ├─ targetLocation ──────┤     ├─ computeLineDiff(sourceCode, targetCode)
  ├─ sourceName ──────────┤     ├─ DiffCodeViewer (source)
  ├─ targetName ──────────┤     └─ DiffCodeViewer (target)
  └─ similarityScore ─────┘
```

The `computeLineDiff` utility function:
```typescript
// packages/uilint-react/src/ui/components/Inspector/diff-utils.ts
function computeLineDiff(sourceCode: string, targetCode: string): {
  sourceLines: DiffLine[];
  targetLines: DiffLine[];
}
```

### Responsive Behavior

- **Narrow sidebar (<500px)**: Force stacked mode, hide side-by-side toggle
- **Medium width (500-800px)**: Default stacked, allow toggle
- **Wide/popped out (>800px)**: Default side-by-side, allow toggle

Use `availableWidth` from `useComposedStore((s) => s.inspector.layoutAvailableWidth)`.

---

## Part 2: Ignore Functionality

### Scope Levels

| Level | What it ignores | Example |
|-------|----------------|---------|
| **Instance** | A specific issue at a specific location | "Ignore this duplicate pair: UserCard ↔ ProfileCard" |
| **Pair** | A duplicate pair regardless of line changes | "Always ignore UserCard ↔ ProfileCard similarity" |
| **File** | All issues of a rule in a file | "Ignore all duplicates in utils/helpers.ts" |
| **Rule** | Disable the rule entirely | Already possible via severity → "off" |

### Persistence: `.uilint/ignores.json`

```json
{
  "$schema": "https://uilint.dev/schemas/ignores.json",
  "version": 1,
  "ignores": [
    {
      "id": "ign_abc123",
      "ruleId": "no-duplicates",
      "type": "pair",
      "source": { "filePath": "src/components/UserCard.tsx", "name": "UserCard" },
      "target": { "filePath": "src/components/ProfileCard.tsx", "name": "ProfileCard" },
      "reason": "Intentionally similar - different data sources",
      "createdAt": "2025-01-15T10:30:00Z",
      "createdBy": "user"
    },
    {
      "id": "ign_def456",
      "ruleId": "no-duplicates",
      "type": "file",
      "filePath": "src/utils/test-helpers.ts",
      "reason": "Test utilities - duplication is acceptable",
      "createdAt": "2025-01-15T11:00:00Z",
      "createdBy": "user"
    }
  ]
}
```

This file is intended to be committed to version control so ignore decisions are shared across the team.

### State Management

#### New Store Slice: `IgnoreSlice`

**Location**: `packages/uilint-react/src/core/store/ignore-slice.ts`

```typescript
interface IgnoreEntry {
  id: string;
  ruleId: string;
  type: "instance" | "pair" | "file";
  // Instance-level
  issueId?: string;
  // Pair-level
  source?: { filePath: string; name: string };
  target?: { filePath: string; name: string };
  // File-level
  filePath?: string;
  // Metadata
  reason?: string;
  createdAt: string;
}

interface IgnoreSlice {
  // State
  ignores: IgnoreEntry[];
  showIgnored: boolean;          // Toggle to show/hide ignored issues

  // Actions
  addIgnore: (entry: Omit<IgnoreEntry, "id" | "createdAt">) => void;
  removeIgnore: (id: string) => void;
  toggleShowIgnored: () => void;

  // Selectors
  isIgnored: (issue: Issue) => boolean;
}
```

This slice gets added to the composed store alongside CoreSlice and DragSlice.

#### Ignore Matching Logic

```typescript
function isIgnored(issue: Issue, ignores: IgnoreEntry[]): boolean {
  for (const ignore of ignores) {
    if (ignore.ruleId !== issue.ruleId) continue;

    switch (ignore.type) {
      case "instance":
        if (ignore.issueId === issue.id) return true;
        break;
      case "pair":
        // Match by source/target names (resilient to line number changes)
        const meta = issue.metadata;
        if (meta &&
            ignore.source?.name === meta.sourceName &&
            ignore.target?.name === meta.targetName &&
            ignore.source?.filePath === JSON.parse(meta.sourceLocation as string).filePath &&
            ignore.target?.filePath === JSON.parse(meta.targetLocation as string).filePath
        ) return true;
        break;
      case "file":
        if (ignore.filePath === issue.filePath) return true;
        break;
    }
  }
  return false;
}
```

#### Server-Side Sync

The ignore list needs to be persisted to disk. The existing WebSocket infrastructure can handle this:

```
UI → "ignore:add" message → Server → writes .uilint/ignores.json
UI → "ignore:remove" message → Server → updates .uilint/ignores.json
Server → "ignore:sync" message → UI (on file change / startup)
```

### UI Components

#### Ignore Button (on each issue)

A subtle button that appears on hover in `DuplicateIssueList` rows and in the `DuplicateComparison` action bar.

```
[ 👁 Ignore ▾ ]
```

Clicking opens a small popover/dropdown:
```
┌─────────────────────────────────┐
│ Ignore this pair                │
│ Ignore all in this file         │
│ ─────────────────────────────── │
│ Add reason (optional)           │
│ ┌─────────────────────────────┐ │
│ │ Intentionally similar       │ │
│ └─────────────────────────────┘ │
│         [Cancel]  [Ignore]      │
└─────────────────────────────────┘
```

#### Ignored Issues Counter (in Rule Header)

When a rule has ignored issues, show a muted counter next to the issue count:

```
no-duplicates     12 issues  (3 ignored)
                              ^^^^^^^^^^^ clickable toggle
```

Clicking "(3 ignored)" toggles `showIgnored`, which dims but shows the ignored issues in the list.

#### Ignored Issue Visual Treatment

When `showIgnored` is true, ignored issues appear in the list but:
- 40% opacity
- Strikethrough on the message
- "Ignored" badge replacing the severity badge
- "Restore" button instead of "Ignore"

When `showIgnored` is false (default), ignored issues are hidden entirely and only the counter is visible.

---

## Part 3: Implementation Plan

### Phase 1: Diff Utilities & DiffCodeViewer (foundation)

**Files to create/modify:**
- `uilint-react/src/ui/components/Inspector/diff-utils.ts` (NEW)
- `uilint-react/src/ui/components/Inspector/DiffCodeViewer.tsx` (NEW)

Steps:
1. Implement `computeLineDiff()` using LCS at line level
2. Build `DiffCodeViewer` component with line-level highlighting
3. Unit tests for diff algorithm

### Phase 2: DuplicateComparison & DuplicateIssueList

**Files to create/modify:**
- `uilint-react/src/ui/components/Inspector/DuplicateComparison.tsx` (NEW)
- `uilint-react/src/ui/components/Inspector/DuplicateIssueList.tsx` (NEW)

Steps:
1. Build `DuplicateComparison` with stacked layout using `DiffCodeViewer`
2. Add side-by-side layout option
3. Build `DuplicateIssueList` as a list of expandable pair cards
4. Parse issue metadata to extract source/target code and locations

### Phase 3: Integration into IssuesList

**Files to modify:**
- `uilint-react/src/ui/components/Inspector/IssuesList.tsx`
- `uilint-core` types (if adding `contentRenderer` to rule contribution)
- `uilint-duplicates/src/plugin/index.ts` (register content renderer)

Steps:
1. Add rule-specific content renderer lookup in `IssuesList`
2. Register `"duplicate-comparison"` renderer from duplicates plugin
3. Wire up the component mapping in uilint-react
4. Ensure the comparison view integrates cleanly with the tile expansion/breadcrumb system

### Phase 4: Ignore System - Core

**Files to create/modify:**
- `uilint-react/src/core/store/ignore-slice.ts` (NEW)
- `uilint-react/src/core/store/composed-store.ts` (add slice)
- `uilint-react/src/core/store/issues-selectors.ts` (filter ignored)

Steps:
1. Define `IgnoreEntry` type and `IgnoreSlice`
2. Integrate into composed store
3. Add `isIgnored` selector logic
4. Filter issues in existing selectors based on ignore state

### Phase 5: Ignore System - Persistence & UI

**Files to create/modify:**
- Server-side: ignore file reader/writer (WebSocket handler)
- `uilint-react/src/ui/components/Inspector/IgnorePopover.tsx` (NEW)
- `uilint-react/src/ui/components/Inspector/RuleHeader.tsx` (add ignored count)
- `uilint-react/src/ui/components/Inspector/DuplicateIssueList.tsx` (add ignore button)
- `uilint-react/src/ui/components/Inspector/DuplicateComparison.tsx` (add ignore action)

Steps:
1. Build `IgnorePopover` component with scope selection and optional reason
2. Add ignore button to duplicate comparison action bar
3. Add ignored issues counter to `RuleHeader`
4. Add show/hide ignored toggle
5. Implement server-side persistence via WebSocket messages
6. Load ignores on startup

### Phase 6: Polish & Testing

1. Responsive behavior (stacked vs side-by-side based on width)
2. Animation (expand/collapse of comparison pairs)
3. Keyboard navigation between pairs
4. Tests for diff algorithm, ignore matching, component rendering
5. Handle edge cases: very long code, missing metadata, stale ignores

---

## Open Questions

1. **Character-level diff**: Should we also highlight character-level differences within modified lines? This adds complexity but improves clarity for subtle differences. *Recommendation: Start without, add later if users request.*

2. **Ignore scope for non-duplicate rules**: Should the ignore system be generic (usable by any rule) from the start, or specific to duplicates? *Recommendation: Build the data model generically but only add UI affordances for duplicates initially.*

3. **Bulk ignore**: Should users be able to select multiple issues and ignore them at once? *Recommendation: Defer to Phase 6 polish.*

4. **Undo**: Should there be an undo toast after ignoring (like Gmail's "Undo" snackbar)? *Recommendation: Yes, low effort and prevents accidental ignores.*
