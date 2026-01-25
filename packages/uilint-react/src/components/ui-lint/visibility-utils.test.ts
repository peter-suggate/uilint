import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { isElementCoveredByOverlay, getElementVisibleRect } from "./visibility-utils";

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

// More complete mock types for getElementVisibleRect tests
interface MockHTMLElement {
  getBoundingClientRect: () => DOMRect;
  parentElement: MockHTMLElement | null;
}

interface MockWindowForRect {
  innerWidth: number;
  innerHeight: number;
  getComputedStyle: (el: MockHTMLElement) => { overflow: string; overflowX: string; overflowY: string };
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

describe("getElementVisibleRect", () => {
  let prevWin: unknown;

  beforeEach(() => {
    prevWin = (globalThis as unknown as { window: unknown }).window;
  });

  afterEach(() => {
    (globalThis as unknown as { window: unknown }).window = prevWin;
  });

  function createMockElement(
    rect: Partial<DOMRect>,
    parentElement: MockHTMLElement | null = null
  ): MockHTMLElement {
    return {
      getBoundingClientRect: () => ({
        x: rect.left ?? 0,
        y: rect.top ?? 0,
        width: rect.width ?? 100,
        height: rect.height ?? 50,
        top: rect.top ?? 0,
        left: rect.left ?? 0,
        right: rect.right ?? (rect.left ?? 0) + (rect.width ?? 100),
        bottom: rect.bottom ?? (rect.top ?? 0) + (rect.height ?? 50),
        toJSON: () => ({}),
      }),
      parentElement,
    };
  }

  function setupWindow(
    innerWidth: number,
    innerHeight: number,
    getComputedStyle?: (el: MockHTMLElement) => { overflow: string; overflowX: string; overflowY: string }
  ) {
    (globalThis as unknown as { window: MockWindowForRect }).window = {
      innerWidth,
      innerHeight,
      getComputedStyle: getComputedStyle ?? (() => ({
        overflow: "visible",
        overflowX: "visible",
        overflowY: "visible",
      })),
    };
  }

  it("returns element rect when fully visible in viewport", () => {
    setupWindow(1920, 1080);

    const element = createMockElement({
      left: 100,
      top: 100,
      width: 200,
      height: 100,
      right: 300,
      bottom: 200,
    });

    const result = getElementVisibleRect(element as unknown as Element);

    expect(result).not.toBeNull();
    expect(result?.left).toBe(100);
    expect(result?.top).toBe(100);
    expect(result?.width).toBe(200);
    expect(result?.height).toBe(100);
  });

  it("returns null when element is completely outside viewport (left)", () => {
    setupWindow(1920, 1080);

    const element = createMockElement({
      left: -300,
      top: 100,
      width: 200,
      height: 100,
      right: -100,
      bottom: 200,
    });

    const result = getElementVisibleRect(element as unknown as Element);

    expect(result).toBeNull();
  });

  it("returns null when element is completely outside viewport (right)", () => {
    setupWindow(1920, 1080);

    const element = createMockElement({
      left: 2000,
      top: 100,
      width: 200,
      height: 100,
      right: 2200,
      bottom: 200,
    });

    const result = getElementVisibleRect(element as unknown as Element);

    expect(result).toBeNull();
  });

  it("returns null when element is completely above viewport", () => {
    setupWindow(1920, 1080);

    const element = createMockElement({
      left: 100,
      top: -200,
      width: 200,
      height: 100,
      right: 300,
      bottom: -100,
    });

    const result = getElementVisibleRect(element as unknown as Element);

    expect(result).toBeNull();
  });

  it("returns null when element is completely below viewport", () => {
    setupWindow(1920, 1080);

    const element = createMockElement({
      left: 100,
      top: 1200,
      width: 200,
      height: 100,
      right: 300,
      bottom: 1300,
    });

    const result = getElementVisibleRect(element as unknown as Element);

    expect(result).toBeNull();
  });

  it("clips element rect to viewport when partially visible", () => {
    setupWindow(1920, 1080);

    // Element extends beyond the right edge of viewport
    const element = createMockElement({
      left: 1800,
      top: 100,
      width: 200,
      height: 100,
      right: 2000,
      bottom: 200,
    });

    const result = getElementVisibleRect(element as unknown as Element);

    expect(result).not.toBeNull();
    expect(result?.left).toBe(1800);
    expect(result?.right).toBe(1920); // Clipped to viewport
    expect(result?.width).toBe(120); // 1920 - 1800
  });

  it("clips element to parent with overflow clipping", () => {
    const parentElement = createMockElement({
      left: 50,
      top: 50,
      width: 100,
      height: 100,
      right: 150,
      bottom: 150,
    });

    const element = createMockElement(
      {
        left: 0,
        top: 0,
        width: 200,
        height: 200,
        right: 200,
        bottom: 200,
      },
      parentElement
    );

    setupWindow(1920, 1080, (el) => {
      if (el === parentElement) {
        return { overflow: "hidden", overflowX: "hidden", overflowY: "hidden" };
      }
      return { overflow: "visible", overflowX: "visible", overflowY: "visible" };
    });

    const result = getElementVisibleRect(element as unknown as Element);

    expect(result).not.toBeNull();
    // Should be clipped to parent's bounds
    expect(result?.left).toBe(50);
    expect(result?.top).toBe(50);
    expect(result?.right).toBe(150);
    expect(result?.bottom).toBe(150);
  });

  it("handles overflow:scroll as clipping", () => {
    const parentElement = createMockElement({
      left: 100,
      top: 100,
      width: 200,
      height: 200,
      right: 300,
      bottom: 300,
    });

    const element = createMockElement(
      {
        left: 50,
        top: 50,
        width: 400,
        height: 400,
        right: 450,
        bottom: 450,
      },
      parentElement
    );

    setupWindow(1920, 1080, (el) => {
      if (el === parentElement) {
        return { overflow: "scroll", overflowX: "scroll", overflowY: "scroll" };
      }
      return { overflow: "visible", overflowX: "visible", overflowY: "visible" };
    });

    const result = getElementVisibleRect(element as unknown as Element);

    expect(result).not.toBeNull();
    expect(result?.left).toBe(100);
    expect(result?.top).toBe(100);
    expect(result?.width).toBe(200);
    expect(result?.height).toBe(200);
  });

  it("handles overflow:auto as clipping", () => {
    const parentElement = createMockElement({
      left: 100,
      top: 100,
      width: 150,
      height: 150,
      right: 250,
      bottom: 250,
    });

    const element = createMockElement(
      {
        left: 50,
        top: 50,
        width: 300,
        height: 300,
        right: 350,
        bottom: 350,
      },
      parentElement
    );

    setupWindow(1920, 1080, (el) => {
      if (el === parentElement) {
        return { overflow: "auto", overflowX: "auto", overflowY: "auto" };
      }
      return { overflow: "visible", overflowX: "visible", overflowY: "visible" };
    });

    const result = getElementVisibleRect(element as unknown as Element);

    expect(result).not.toBeNull();
    expect(result?.left).toBe(100);
    expect(result?.top).toBe(100);
  });

  it("returns null when element is completely hidden by ancestor overflow", () => {
    const parentElement = createMockElement({
      left: 100,
      top: 100,
      width: 100,
      height: 100,
      right: 200,
      bottom: 200,
    });

    // Element is positioned outside parent's clipping area
    const element = createMockElement(
      {
        left: 300,
        top: 300,
        width: 50,
        height: 50,
        right: 350,
        bottom: 350,
      },
      parentElement
    );

    setupWindow(1920, 1080, (el) => {
      if (el === parentElement) {
        return { overflow: "hidden", overflowX: "hidden", overflowY: "hidden" };
      }
      return { overflow: "visible", overflowX: "visible", overflowY: "visible" };
    });

    const result = getElementVisibleRect(element as unknown as Element);

    expect(result).toBeNull();
  });

  it("does not clip when parent has overflow:visible", () => {
    const parentElement = createMockElement({
      left: 100,
      top: 100,
      width: 100,
      height: 100,
      right: 200,
      bottom: 200,
    });

    const element = createMockElement(
      {
        left: 50,
        top: 50,
        width: 300,
        height: 300,
        right: 350,
        bottom: 350,
      },
      parentElement
    );

    setupWindow(1920, 1080, () => ({
      overflow: "visible",
      overflowX: "visible",
      overflowY: "visible",
    }));

    const result = getElementVisibleRect(element as unknown as Element);

    expect(result).not.toBeNull();
    // Should still be clipped to viewport, but not parent
    expect(result?.left).toBe(50);
    expect(result?.top).toBe(50);
    expect(result?.width).toBe(300);
    expect(result?.height).toBe(300);
  });

  it("handles nested overflow clipping from multiple ancestors", () => {
    const grandparent = createMockElement({
      left: 0,
      top: 0,
      width: 500,
      height: 500,
      right: 500,
      bottom: 500,
    });

    const parentElement = createMockElement(
      {
        left: 100,
        top: 100,
        width: 200,
        height: 200,
        right: 300,
        bottom: 300,
      },
      grandparent
    );

    const element = createMockElement(
      {
        left: 50,
        top: 50,
        width: 400,
        height: 400,
        right: 450,
        bottom: 450,
      },
      parentElement
    );

    setupWindow(1920, 1080, (el) => {
      if (el === grandparent) {
        return { overflow: "hidden", overflowX: "hidden", overflowY: "hidden" };
      }
      if (el === parentElement) {
        return { overflow: "hidden", overflowX: "hidden", overflowY: "hidden" };
      }
      return { overflow: "visible", overflowX: "visible", overflowY: "visible" };
    });

    const result = getElementVisibleRect(element as unknown as Element);

    expect(result).not.toBeNull();
    // Should be clipped by the tighter parent constraint
    expect(result?.left).toBe(100);
    expect(result?.top).toBe(100);
    expect(result?.right).toBe(300);
    expect(result?.bottom).toBe(300);
  });
});
