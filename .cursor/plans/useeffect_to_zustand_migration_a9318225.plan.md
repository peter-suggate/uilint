---
name: useEffect to Zustand Migration
overview: Migrate useEffect-based side effects to Zustand store actions, subscriptions, and middleware, eliminating unnecessary synchronization effects while keeping the UI reactive and efficient.
todos:
  - id: create-subscriptions
    content: Create subscriptions.ts with keyboard, resize, and mobile detection handlers
    status: pending
  - id: add-mobile-state
    content: Add mobile detection state to core-slice.ts
    status: pending
    dependencies:
      - create-subscriptions
  - id: enhance-category-loading
    content: Move category loading trigger into setSelectedCategory action
    status: pending
  - id: migrate-command-palette
    content: Remove local state and useEffects from CommandPalette.tsx
    status: pending
    dependencies:
      - enhance-category-loading
  - id: create-drag-slice
    content: Create drag-slice.ts for unified drag state management
    status: pending
  - id: migrate-floating-icon
    content: Remove drag useEffects from FloatingIcon.tsx
    status: pending
    dependencies:
      - create-drag-slice
  - id: migrate-inspector
    content: Remove useEffects from InspectorSidebar.tsx
    status: pending
    dependencies:
      - add-mobile-state
      - create-drag-slice
  - id: delete-hooks
    content: Delete useKeyboardShortcuts.ts, useIsMobile.ts, useTouchDrag.ts
    status: pending
    dependencies:
      - migrate-command-palette
      - migrate-floating-icon
      - migrate-inspector
  - id: convert-dom-effects
    content: Convert remaining DOM effects to useLayoutEffect where appropriate
    status: pending
---

# Eliminate useEffect: Migrate to Zustand Store Architecture

## Problem Analysis

Found **37 useEffect occurrences** across 13 files. These fall into 4 categories:

| Category | Count | Strategy |

|----------|-------|----------|

| State synchronization | 7 | Move to store actions |

| Event listeners | 12 | Store subscriptions / middleware |

| DOM side effects | 6 | Keep minimal `useLayoutEffect` or refs |

| Derived state | 5 | Use Zustand selectors with `subscribeWithSelector` |

---

## Architecture: Zustand Subscription System

Create a centralized subscription layer that runs outside React, handling all event listeners via store middleware.

```mermaid
flowchart LR
    subgraph React[React Components]
        CP[CommandPalette]
        FI[FloatingIcon]
        IS[InspectorSidebar]
    end

    subgraph Store[Zustand Store]
        CS[Core Slice]
        PS[Plugin Slices]
        Subs[Subscriptions Middleware]
    end

    subgraph External[External Effects]
        KB[Keyboard Events]
        RS[Resize/Mobile Events]
        DOM[DOM Mutations]
    end

    External --> Subs
    Subs --> CS
    CS --> React
</thinking>
```

---

## Phase 1: Eliminate State Sync Effects in CommandPalette

**File:** [`packages/uilint-react/src/ui/components/CommandPalette/CommandPalette.tsx`](packages/uilint-react/src/ui/components/CommandPalette/CommandPalette.tsx)

### 1.1 Remove local `query`/`selectedIndex` state, move to store

The `CommandPaletteState` in [`core-slice.ts`](packages/uilint-react/src/core/store/core-slice.ts) already has `query` and `selectedIndex`. The component duplicates this with `useState`. Remove local state and use store directly:

**Current (to remove):**

```typescript
const [query, setQuery] = useState("");
const [selectedIndex, setSelectedIndex] = useState(0);
```

**New (use store):**

```typescript
const query = useComposedStore((s) => s.commandPalette.query);
const selectedIndex = useComposedStore((s) => s.commandPalette.selectedIndex);
const setQuery = useComposedStore((s) => s.setCommandPaletteQuery);
const setSelectedIndex = useComposedStore((s) => s.setCommandPaletteSelectedIndex);
```

This eliminates **2 useEffects** (query reset + close reset) since `setCommandPaletteQuery` already resets `selectedIndex` and `closeCommandPalette` already resets state.

### 1.2 Load categories on selection via action

Modify `setSelectedCategory` in [`core-slice.ts`](packages/uilint-react/src/core/store/core-slice.ts) to trigger category loading:

```typescript
setSelectedCategory: (categoryId) => {
  set({
    commandPalette: {
      ...get().commandPalette,
      selectedCategoryId: categoryId,
      selectedIndex: 0,
    },
  });
  // Trigger loading in the action itself
  if (categoryId) {
    get().loadCategoryItems(categoryId);
  }
},
```

This eliminates the `useEffect` for category loading.

---

## Phase 2: Create Subscriptions Middleware

**New file:** `packages/uilint-react/src/core/store/subscriptions.ts`

Create a store-level subscription system that:

- Registers keyboard shortcuts
- Handles resize/orientation events
- Manages alt-key state
```typescript
export function initializeSubscriptions(store: StoreApi<ComposedStore>) {
  // Keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent) => {
    const state = store.getState();
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      state.commandPalette.open ? state.closeCommandPalette() : state.openCommandPalette();
    }
    if (e.key === "Escape" && state.commandPalette.open) {
      state.closeCommandPalette();
    }
    if (e.key === "Alt") {
      state.setAltKeyHeld(true);
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.key === "Alt") {
      store.getState().setAltKeyHeld(false);
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);

  // Cleanup function
  return () => {
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
  };
}
```


This eliminates `useKeyboardShortcuts` hook entirely.

---

## Phase 3: Mobile State in Store

**File:** [`packages/uilint-react/src/core/store/core-slice.ts`](packages/uilint-react/src/core/store/core-slice.ts)

Add mobile detection state to core slice:

```typescript
interface CoreSlice {
  // ... existing
  isMobile: boolean;
  isTouchDevice: boolean;
  isSmallScreen: boolean;
  _initializeMobileDetection: () => () => void; // Returns cleanup
}
```

Initialize in `subscriptions.ts`:

```typescript
function initializeMobileDetection(store: StoreApi<ComposedStore>) {
  const update = () => {
    const isMobile = window.innerWidth < 768;
    const isSmallScreen = window.innerWidth < 640;
    const isTouchDevice = 'ontouchstart' in window;
    store.setState({ isMobile, isSmallScreen, isTouchDevice });
  };
  
  update();
  window.addEventListener("resize", update);
  window.addEventListener("orientationchange", update);
  
  return () => {
    window.removeEventListener("resize", update);
    window.removeEventListener("orientationchange", update);
  };
}
```

This eliminates `useIsMobile` hook - components just read from store.

---

## Phase 4: Inspector Auto-Undock via Subscription

Use `store.subscribe` with selector to react to mobile + docked state:

```typescript
// In subscriptions.ts
store.subscribe(
  (state) => ({ isMobile: state.isMobile, docked: state.inspector.docked, open: state.inspector.open }),
  ({ isMobile, docked, open }) => {
    if (isMobile && docked && open) {
      store.getState().toggleInspectorDocked();
    }
  },
  { equalityFn: shallow }
);
```

This eliminates the `useEffect` in InspectorSidebar for mobile auto-undock.

---

## Phase 5: Drag/Resize as Store State

Create a `DragSlice` for unified drag handling:

**New file:** `packages/uilint-react/src/core/store/drag-slice.ts`

```typescript
Did interface DragSlice {
  activeDrag: {
    type: "floating-icon" | "inspector" | "resize" | null;
    startPos: { x: number; y: number };
    currentPos: { x: number; y: number };
  } | null;
  startDrag: (type: string, pos: { x: number; y: number }) => void;
  updateDrag: (pos: { x: number; y: number }) => void;
  endDrag: () => void;
}
```

Global mouse/touch listeners in `subscriptions.ts` dispatch to store, components just read state.

---

## Summary of Files to Change

| File | Changes |

|------|---------|

| [`core-slice.ts`](packages/uilint-react/src/core/store/core-slice.ts) | Add mobile state, enhance `setSelectedCategory` |

| **NEW** `subscriptions.ts` | Centralized event subscriptions |

| [`composed-store.ts`](packages/uilint-react/src/core/store/composed-store.ts) | Initialize subscriptions on store creation |

| [`CommandPalette.tsx`](packages/uilint-react/src/ui/components/CommandPalette/CommandPalette.tsx) | Remove 3 useEffects, use store query/selectedIndex |

| [`FloatingIcon.tsx`](packages/uilint-react/src/ui/components/FloatingIcon.tsx) | Remove drag useEffects, use DragSlice |

| [`InspectorSidebar.tsx`](packages/uilint-react/src/ui/components/Inspector/InspectorSidebar.tsx) | Remove 4 useEffects for mobile/drag/resize |

| [`UILint.tsx`](packages/uilint-react/src/ui/UILint.tsx) | Remove keyboard shortcut hook, keep portal effect |

| `hooks/useKeyboardShortcuts.ts` | **DELETE** (replaced by subscriptions) |

| `hooks/useIsMobile.ts` | **DELETE** (replaced by store state) |

| `hooks/useTouchDrag.ts` | **DELETE** (replaced by DragSlice) |

---

## Effects That Should Remain

Some effects are inherently DOM-focused and should stay:

1. **Portal creation** (UILint.tsx) - creates DOM element
2. **Auto-focus** (SearchInput.tsx) - imperative DOM operation
3. **Document margin** (InspectorSidebar.tsx) - modifies `<html>` style
4. **Scroll into view** (useScrollSelectedIntoView.ts) - imperative scroll

These can be converted to `useLayoutEffect` for synchronous DOM updates.

---

## Efficiency Considerations

- **Memoized selectors**: Use `createSelector` from reselect for derived state (filtered commands, grouped issues)
- **Shallow equality**: Use `shallow` comparison for object selectors to prevent unnecessary re-renders
- **Batch updates**: Zustand already batches updates automatically