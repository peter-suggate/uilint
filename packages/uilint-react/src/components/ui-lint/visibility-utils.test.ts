import { describe, expect, it } from "vitest";
import { isElementCoveredByOverlay } from "./visibility-utils";

describe("visibility-utils", () => {
  it("does not treat a backdrop behind an ancestor container as covering", () => {
    const prevDoc = (globalThis as any).document;
    const prevWin = (globalThis as any).window;

    // Create a minimal element graph:
    // backdrop (fixed + zIndex) is behind dialog which contains target.
    // elementsFromPoint returns front-to-back: [dialog, backdrop]
    const target: any = {
      contains: () => false,
    };

    const dialog: any = {
      hasAttribute: () => false,
      contains: (node: any) => node === target,
    };

    const backdrop: any = {
      hasAttribute: () => false,
      contains: () => false,
    };

    try {
      (globalThis as any).document = {
        elementsFromPoint: () => [dialog, backdrop],
      };
      (globalThis as any).window = {
        getComputedStyle: (el: any) => {
          if (el === backdrop) {
            return { position: "fixed", zIndex: "50" };
          }
          return { position: "static", zIndex: "auto" };
        },
      };

      expect(isElementCoveredByOverlay(target, 10, 10)).toBe(false);
    } finally {
      (globalThis as any).document = prevDoc;
      (globalThis as any).window = prevWin;
    }
  });

  it("treats a fixed overlay above the element (not an ancestor) as covering", () => {
    const prevDoc = (globalThis as any).document;
    const prevWin = (globalThis as any).window;

    const target: any = {
      contains: () => false,
    };
    const overlay: any = {
      hasAttribute: () => false,
      contains: () => false,
    };

    try {
      (globalThis as any).document = {
        elementsFromPoint: () => [overlay],
      };
      (globalThis as any).window = {
        getComputedStyle: () => ({ position: "fixed", zIndex: "100" }),
      };

      expect(isElementCoveredByOverlay(target, 10, 10)).toBe(true);
    } finally {
      (globalThis as any).document = prevDoc;
      (globalThis as any).window = prevWin;
    }
  });
});
