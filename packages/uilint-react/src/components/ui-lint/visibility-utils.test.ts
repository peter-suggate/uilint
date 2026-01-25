import { describe, expect, it } from "vitest";
import { isElementCoveredByOverlay } from "./visibility-utils";

// Mock types for DOM elements in tests
interface MockElement {
  contains: (node: MockElement) => boolean;
  hasAttribute?: () => boolean;
}

interface MockDocument {
  elementsFromPoint: (x: number, y: number) => MockElement[];
}

interface MockWindow {
  getComputedStyle: (el: MockElement) => { position: string; zIndex: string };
}

describe("visibility-utils", () => {
  it("does not treat a backdrop behind an ancestor container as covering", () => {
    const prevDoc = (globalThis as unknown as { document: unknown }).document;
    const prevWin = (globalThis as unknown as { window: unknown }).window;

    // Create a minimal element graph:
    // backdrop (fixed + zIndex) is behind dialog which contains target.
    // elementsFromPoint returns front-to-back: [dialog, backdrop]
    const target: MockElement = {
      contains: () => false,
    };

    const dialog: MockElement = {
      hasAttribute: () => false,
      contains: (node: MockElement) => node === target,
    };

    const backdrop: MockElement = {
      hasAttribute: () => false,
      contains: () => false,
    };

    try {
      (globalThis as unknown as { document: MockDocument }).document = {
        elementsFromPoint: () => [dialog, backdrop],
      };
      (globalThis as unknown as { window: MockWindow }).window = {
        getComputedStyle: (el: MockElement) => {
          if (el === backdrop) {
            return { position: "fixed", zIndex: "50" };
          }
          return { position: "static", zIndex: "auto" };
        },
      };

      expect(isElementCoveredByOverlay(target as unknown as Element, 10, 10)).toBe(false);
    } finally {
      (globalThis as unknown as { document: unknown }).document = prevDoc;
      (globalThis as unknown as { window: unknown }).window = prevWin;
    }
  });

  it("treats a fixed overlay above the element (not an ancestor) as covering", () => {
    const prevDoc = (globalThis as unknown as { document: unknown }).document;
    const prevWin = (globalThis as unknown as { window: unknown }).window;

    const target: MockElement = {
      contains: () => false,
    };
    const overlay: MockElement = {
      hasAttribute: () => false,
      contains: () => false,
    };

    try {
      (globalThis as unknown as { document: MockDocument }).document = {
        elementsFromPoint: () => [overlay],
      };
      (globalThis as unknown as { window: MockWindow }).window = {
        getComputedStyle: () => ({ position: "fixed", zIndex: "100" }),
      };

      expect(isElementCoveredByOverlay(target as unknown as Element, 10, 10)).toBe(true);
    } finally {
      (globalThis as unknown as { document: unknown }).document = prevDoc;
      (globalThis as unknown as { window: unknown }).window = prevWin;
    }
  });
});
