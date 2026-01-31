export { useIssues } from "./useIssues";
export { useElementRects } from "./useElementRects";
export { useSourceCode } from "./useSourceCode";
export {
  useCategoryRegistry,
  useCategoryItems,
  useCategoryItemsDirect,
  useLoadCategoryItems,
  useLoadCategoryWithChildren,
  type UseCategoryRegistryReturn,
} from "./useCategoryRegistry";

// Re-export BREAKPOINTS from core-slice for backward compatibility
export { BREAKPOINTS } from "../../core/store/core-slice";

// Note: useKeyboardShortcuts, useIsMobile, and useTouchDrag have been removed.
// - Keyboard shortcuts are now handled by the subscription system (subscriptions.ts)
// - Mobile state is now in the store (core-slice.ts mobile state)
// - Drag state is now in the store (drag-slice.ts)
