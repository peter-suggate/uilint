/**
 * Coverage tests for dom-observer module
 *
 * Focuses on DOMObserverServiceImpl class behavior including:
 * - start/stop lifecycle
 * - Subscription registration and unsubscription
 * - Scanning and reconciliation logic
 * - node_modules filtering via setHideNodeModules
 * - UILint UI element exclusion
 * - MutationObserver integration and debounced reconciliation
 * - Handler error isolation
 * - Multiple occurrences of same data-loc
 * - Factory function createDOMObserverService
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  DOMObserverServiceImpl,
  createDOMObserverService,
  DATA_LOC_ATTR,
  RECONCILE_DEBOUNCE_MS,
  generateElementId,
  parseDataLoc,
  shouldFilterPath,
} from "./dom-observer";

// =============================================================================
// Global shims for Node test environment
// =============================================================================

// The source code uses `typeof window === "undefined"` as an SSR guard in
// reconcile() and `node instanceof Element` in hasDataLocElements().
// In vitest's "node" environment, neither window nor Element exist,
// so we define minimal shims.

class MockElement {}

const savedWindow = globalThis.window;
const savedElement = globalThis.Element;

beforeEach(() => {
  // Make `typeof window !== "undefined"` pass the SSR guard
  (globalThis as Record<string, unknown>).window = globalThis;
  // Make `node instanceof Element` work for our mock mutation nodes
  (globalThis as Record<string, unknown>).Element = MockElement;
});

afterEach(() => {
  if (savedWindow === undefined) {
    delete (globalThis as Record<string, unknown>).window;
  } else {
    (globalThis as Record<string, unknown>).window = savedWindow;
  }
  if (savedElement === undefined) {
    delete (globalThis as Record<string, unknown>).Element;
  } else {
    (globalThis as Record<string, unknown>).Element = savedElement;
  }
});

// =============================================================================
// Mock DOM Helpers
// =============================================================================

/**
 * Minimal mock of a DOMRect returned by getBoundingClientRect
 */
function mockRect(
  x = 0,
  y = 0,
  width = 100,
  height = 50
): DOMRect {
  return {
    x,
    y,
    width,
    height,
    top: y,
    right: x + width,
    bottom: y + height,
    left: x,
    toJSON() {
      return { x, y, width, height, top: y, right: x + width, bottom: y + height, left: x };
    },
  } as DOMRect;
}

/**
 * Create a mock Element with minimal interface needed by the service.
 * Supports data-loc attribute and optional wrapping in a data-ui-lint container.
 */
function createMockElement(opts: {
  tagName?: string;
  dataLoc?: string;
  insideUILint?: boolean;
  rect?: DOMRect;
}): Element {
  const {
    tagName = "div",
    dataLoc,
    insideUILint = false,
    rect = mockRect(),
  } = opts;

  const attributes: Record<string, string> = {};
  if (dataLoc !== undefined) {
    attributes[DATA_LOC_ATTR] = dataLoc;
  }

  const el = {
    tagName: tagName.toUpperCase(),
    hasAttribute(name: string) {
      return name in attributes;
    },
    getAttribute(name: string) {
      return attributes[name] ?? null;
    },
    closest(selector: string) {
      if (selector === "[data-ui-lint]" && insideUILint) {
        return {}; // truthy = inside UILint
      }
      return null;
    },
    getBoundingClientRect() {
      return rect;
    },
    querySelector(_selector: string) {
      return null;
    },
  } as unknown as Element;

  return el;
}

/**
 * Create a mock MutationObserver class that allows test code to trigger mutations.
 */
function createMockMutationObserver() {
  let callback: MutationCallback | null = null;

  const instance = {
    observe: vi.fn(),
    disconnect: vi.fn(),
    takeRecords: vi.fn(() => []),
  };

  const MockClass = vi.fn(function (cb: MutationCallback) {
    callback = cb;
    return instance;
  }) as unknown as typeof MutationObserver;

  return {
    MockClass,
    instance,
    /** Trigger the mutation callback with the provided records */
    triggerMutations(records: Partial<MutationRecord>[]) {
      callback?.call(
        instance as unknown as MutationObserver,
        records as MutationRecord[],
        instance as unknown as MutationObserver,
      );
    },
  };
}

/**
 * Build a querySelectorAll mock function that returns the given elements.
 * The elements list can be updated between calls via the returned setter.
 */
function createQuerySelectorAll() {
  let elements: Element[] = [];

  const fn = vi.fn((_selector: string) => {
    return elements as unknown as NodeListOf<Element>;
  });

  return {
    fn,
    setElements(els: Element[]) {
      elements = els;
    },
  };
}

/**
 * Create a mock text Node (not an Element) for MutationRecord addedNodes/removedNodes.
 * Will fail the `node instanceof Element` check.
 */
function createMockTextNode(): Node {
  return { nodeType: 3 } as unknown as Node;
}

/**
 * Create a mock Element node that passes `instanceof Element` for use in
 * MutationRecord addedNodes/removedNodes. Supports hasAttribute and querySelector
 * so hasDataLocElements works.
 */
function createMockMutationNode(opts: {
  hasDataLoc?: boolean;
  hasChildWithDataLoc?: boolean;
}): Node {
  const { hasDataLoc = false, hasChildWithDataLoc = false } = opts;

  // Must extend MockElement so `instanceof Element` passes
  const node = Object.create(MockElement.prototype);
  node.hasAttribute = (name: string) => hasDataLoc && name === DATA_LOC_ATTR;
  node.querySelector = (selector: string) => {
    if (hasChildWithDataLoc && selector === `[${DATA_LOC_ATTR}]`) {
      return {}; // truthy = found a descendant
    }
    return null;
  };

  return node as unknown as Node;
}

// =============================================================================
// Test harness
// =============================================================================

interface TestHarness {
  service: DOMObserverServiceImpl;
  mutationObserver: ReturnType<typeof createMockMutationObserver>;
  querySelectorAll: ReturnType<typeof createQuerySelectorAll>;
  root: Element;
}

function createTestHarness(): TestHarness {
  const mutationObserver = createMockMutationObserver();
  const querySelectorAll = createQuerySelectorAll();
  const root = createMockElement({ tagName: "body" });

  const service = new DOMObserverServiceImpl({
    root,
    MutationObserverImpl: mutationObserver.MockClass,
    querySelectorAll: querySelectorAll.fn,
  });

  return { service, mutationObserver, querySelectorAll, root };
}

// =============================================================================
// Tests
// =============================================================================

describe("DOMObserverServiceImpl", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // start() / stop() lifecycle
  // ---------------------------------------------------------------------------

  describe("start()", () => {
    it("creates a MutationObserver and begins observing the root", () => {
      const { service, mutationObserver, root } = createTestHarness();

      service.start();

      expect(mutationObserver.MockClass).toHaveBeenCalledOnce();
      expect(mutationObserver.instance.observe).toHaveBeenCalledWith(root, {
        childList: true,
        subtree: true,
      });
    });

    it("runs an initial reconcile (scan) on start", () => {
      const { service, querySelectorAll } = createTestHarness();

      const el = createMockElement({ dataLoc: "src/App.tsx:1:0" });
      querySelectorAll.setElements([el]);

      const addHandler = vi.fn();
      service.onElementsAdded(addHandler);

      service.start();

      expect(querySelectorAll.fn).toHaveBeenCalled();
      expect(addHandler).toHaveBeenCalledOnce();
      expect(addHandler).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: "loc:src/App.tsx:1:0#1",
            dataLoc: "src/App.tsx:1:0",
            tagName: "div",
          }),
        ])
      );
    });

    it("does not start twice if called multiple times", () => {
      const { service, mutationObserver } = createTestHarness();

      service.start();
      service.start();

      expect(mutationObserver.MockClass).toHaveBeenCalledOnce();
    });
  });

  describe("stop()", () => {
    it("disconnects the MutationObserver", () => {
      const { service, mutationObserver } = createTestHarness();

      service.start();
      service.stop();

      expect(mutationObserver.instance.disconnect).toHaveBeenCalledOnce();
    });

    it("clears known elements so re-start re-emits additions", () => {
      const { service, querySelectorAll } = createTestHarness();

      const el = createMockElement({ dataLoc: "src/App.tsx:1:0" });
      querySelectorAll.setElements([el]);

      service.start();
      expect(service.getElements()).toHaveLength(1);

      service.stop();

      // Re-start should re-detect the same element as new
      const addHandler = vi.fn();
      service.onElementsAdded(addHandler);
      service.start();
      expect(addHandler).toHaveBeenCalledOnce();
    });

    it("clears any pending debounced reconciliation", () => {
      const { service, mutationObserver, querySelectorAll } = createTestHarness();

      const el = createMockElement({ dataLoc: "src/App.tsx:1:0" });
      querySelectorAll.setElements([el]);

      service.start();

      // Trigger a mutation to start a debounced reconcile
      const mutNode = createMockMutationNode({ hasDataLoc: true });
      mutationObserver.triggerMutations([
        { addedNodes: [mutNode] as unknown as NodeList, removedNodes: [] as unknown as NodeList },
      ]);

      // Stop before debounce fires
      service.stop();

      // Advance timers - the debounced reconcile was cleared, so nothing should happen
      const addHandler = vi.fn();
      service.onElementsAdded(addHandler);
      vi.advanceTimersByTime(RECONCILE_DEBOUNCE_MS + 50);

      expect(addHandler).not.toHaveBeenCalled();
    });

    it("is safe to call stop when not started", () => {
      const { service } = createTestHarness();
      expect(() => service.stop()).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // Subscription management
  // ---------------------------------------------------------------------------

  describe("onElementsAdded()", () => {
    it("returns an unsubscribe function that prevents further calls", () => {
      const { service, querySelectorAll } = createTestHarness();
      const handler = vi.fn();
      const unsubscribe = service.onElementsAdded(handler);

      expect(typeof unsubscribe).toBe("function");

      unsubscribe();

      const el = createMockElement({ dataLoc: "src/App.tsx:1:0" });
      querySelectorAll.setElements([el]);
      service.start();

      expect(handler).not.toHaveBeenCalled();
    });

    it("supports multiple handlers", () => {
      const { service, querySelectorAll } = createTestHarness();

      const handler1 = vi.fn();
      const handler2 = vi.fn();
      service.onElementsAdded(handler1);
      service.onElementsAdded(handler2);

      const el = createMockElement({ dataLoc: "src/App.tsx:1:0" });
      querySelectorAll.setElements([el]);
      service.start();

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
    });

    it("does not call handler when no elements are found", () => {
      const { service, querySelectorAll } = createTestHarness();

      const handler = vi.fn();
      service.onElementsAdded(handler);

      querySelectorAll.setElements([]);
      service.start();

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("onElementsRemoved()", () => {
    it("returns an unsubscribe function", () => {
      const { service } = createTestHarness();
      const handler = vi.fn();
      const unsubscribe = service.onElementsRemoved(handler);

      expect(typeof unsubscribe).toBe("function");
      unsubscribe();
    });

    it("calls handler when previously known elements disappear", () => {
      const { service, querySelectorAll, mutationObserver } = createTestHarness();

      const el = createMockElement({ dataLoc: "src/App.tsx:1:0" });
      querySelectorAll.setElements([el]);

      const removeHandler = vi.fn();
      service.onElementsRemoved(removeHandler);
      service.start();

      // Remove the element
      querySelectorAll.setElements([]);

      const mutNode = createMockMutationNode({ hasDataLoc: true });
      mutationObserver.triggerMutations([
        { addedNodes: [] as unknown as NodeList, removedNodes: [mutNode] as unknown as NodeList },
      ]);

      vi.advanceTimersByTime(RECONCILE_DEBOUNCE_MS + 10);

      expect(removeHandler).toHaveBeenCalledOnce();
      expect(removeHandler).toHaveBeenCalledWith(["loc:src/App.tsx:1:0#1"]);
    });

    it("supports multiple removal handlers", () => {
      const { service, querySelectorAll, mutationObserver } = createTestHarness();

      const el = createMockElement({ dataLoc: "src/Page.tsx:5:0" });
      querySelectorAll.setElements([el]);

      const handler1 = vi.fn();
      const handler2 = vi.fn();
      service.onElementsRemoved(handler1);
      service.onElementsRemoved(handler2);

      service.start();

      querySelectorAll.setElements([]);
      const mutNode = createMockMutationNode({ hasDataLoc: true });
      mutationObserver.triggerMutations([
        { addedNodes: [] as unknown as NodeList, removedNodes: [mutNode] as unknown as NodeList },
      ]);
      vi.advanceTimersByTime(RECONCILE_DEBOUNCE_MS + 10);

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
    });

    it("unsubscribed handler is not called on removal events", () => {
      const { service, querySelectorAll, mutationObserver } = createTestHarness();

      const el = createMockElement({ dataLoc: "src/App.tsx:1:0" });
      querySelectorAll.setElements([el]);

      const handler = vi.fn();
      const unsubscribe = service.onElementsRemoved(handler);

      service.start();
      unsubscribe();

      querySelectorAll.setElements([]);
      const mutNode = createMockMutationNode({ hasDataLoc: true });
      mutationObserver.triggerMutations([
        { addedNodes: [] as unknown as NodeList, removedNodes: [mutNode] as unknown as NodeList },
      ]);
      vi.advanceTimersByTime(RECONCILE_DEBOUNCE_MS + 10);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // getElements()
  // ---------------------------------------------------------------------------

  describe("getElements()", () => {
    it("returns currently scanned elements with correct shape", () => {
      const { service, querySelectorAll } = createTestHarness();

      const el1 = createMockElement({ dataLoc: "src/A.tsx:1:0" });
      const el2 = createMockElement({ dataLoc: "src/B.tsx:2:0", tagName: "span" });
      querySelectorAll.setElements([el1, el2]);

      const elements = service.getElements();

      expect(elements).toHaveLength(2);
      expect(elements[0]).toMatchObject({
        id: "loc:src/A.tsx:1:0#1",
        dataLoc: "src/A.tsx:1:0",
        tagName: "div",
      });
      expect(elements[1]).toMatchObject({
        id: "loc:src/B.tsx:2:0#1",
        dataLoc: "src/B.tsx:2:0",
        tagName: "span",
      });
    });

    it("returns empty array when no elements have data-loc", () => {
      const { service, querySelectorAll } = createTestHarness();
      querySelectorAll.setElements([]);

      expect(service.getElements()).toEqual([]);
    });

    it("includes rect information from getBoundingClientRect", () => {
      const { service, querySelectorAll } = createTestHarness();

      const customRect = mockRect(10, 20, 200, 100);
      const el = createMockElement({ dataLoc: "src/App.tsx:1:0", rect: customRect });
      querySelectorAll.setElements([el]);

      const elements = service.getElements();
      expect(elements[0].rect).toBe(customRect);
    });

    it("preserves element reference in the returned info", () => {
      const { service, querySelectorAll } = createTestHarness();

      const el = createMockElement({ dataLoc: "src/App.tsx:1:0" });
      querySelectorAll.setElements([el]);

      const elements = service.getElements();
      expect(elements[0].element).toBe(el);
    });
  });

  // ---------------------------------------------------------------------------
  // Scanning and filtering logic
  // ---------------------------------------------------------------------------

  describe("scanning logic", () => {
    it("generates unique IDs for multiple elements with the same data-loc", () => {
      const { service, querySelectorAll } = createTestHarness();

      const el1 = createMockElement({ dataLoc: "src/List.tsx:10:4" });
      const el2 = createMockElement({ dataLoc: "src/List.tsx:10:4" });
      const el3 = createMockElement({ dataLoc: "src/List.tsx:10:4" });
      querySelectorAll.setElements([el1, el2, el3]);

      const elements = service.getElements();

      expect(elements).toHaveLength(3);
      expect(elements[0].id).toBe("loc:src/List.tsx:10:4#1");
      expect(elements[1].id).toBe("loc:src/List.tsx:10:4#2");
      expect(elements[2].id).toBe("loc:src/List.tsx:10:4#3");
    });

    it("skips elements inside a [data-ui-lint] container", () => {
      const { service, querySelectorAll } = createTestHarness();

      const normalEl = createMockElement({ dataLoc: "src/App.tsx:1:0" });
      const uiLintEl = createMockElement({
        dataLoc: "src/Panel.tsx:5:0",
        insideUILint: true,
      });
      querySelectorAll.setElements([normalEl, uiLintEl]);

      const elements = service.getElements();

      expect(elements).toHaveLength(1);
      expect(elements[0].dataLoc).toBe("src/App.tsx:1:0");
    });

    it("skips elements with empty data-loc attribute", () => {
      const { service, querySelectorAll } = createTestHarness();

      const validEl = createMockElement({ dataLoc: "src/App.tsx:1:0" });
      const emptyEl = createMockElement({ dataLoc: "" });
      querySelectorAll.setElements([validEl, emptyEl]);

      const elements = service.getElements();

      expect(elements).toHaveLength(1);
      expect(elements[0].dataLoc).toBe("src/App.tsx:1:0");
    });

    it("normalizes runtime ID format in data-loc attributes", () => {
      const { service, querySelectorAll } = createTestHarness();

      const el = createMockElement({ dataLoc: "loc:src/App.tsx:1:0#3" });
      querySelectorAll.setElements([el]);

      const elements = service.getElements();

      expect(elements).toHaveLength(1);
      expect(elements[0].dataLoc).toBe("src/App.tsx:1:0");
      expect(elements[0].id).toBe("loc:src/App.tsx:1:0#1");
    });
  });

  // ---------------------------------------------------------------------------
  // node_modules filtering
  // ---------------------------------------------------------------------------

  describe("setHideNodeModules()", () => {
    it("filters out node_modules paths by default (hideNodeModules=true)", () => {
      const { service, querySelectorAll } = createTestHarness();

      const appEl = createMockElement({ dataLoc: "src/App.tsx:1:0" });
      const nmEl = createMockElement({
        dataLoc: "node_modules/react/index.js:5:0",
      });
      querySelectorAll.setElements([appEl, nmEl]);

      const elements = service.getElements();

      expect(elements).toHaveLength(1);
      expect(elements[0].dataLoc).toBe("src/App.tsx:1:0");
    });

    it("includes node_modules paths when hideNodeModules is set to false", () => {
      const { service, querySelectorAll } = createTestHarness();

      const appEl = createMockElement({ dataLoc: "src/App.tsx:1:0" });
      const nmEl = createMockElement({
        dataLoc: "node_modules/react/index.js:5:0",
      });
      querySelectorAll.setElements([appEl, nmEl]);

      service.setHideNodeModules(false);

      const elements = service.getElements();

      expect(elements).toHaveLength(2);
    });

    it("triggers reconciliation when changed while running", () => {
      const { service, querySelectorAll } = createTestHarness();

      const appEl = createMockElement({ dataLoc: "src/App.tsx:1:0" });
      const nmEl = createMockElement({
        dataLoc: "node_modules/react/index.js:5:0",
      });
      querySelectorAll.setElements([appEl, nmEl]);

      const addHandler = vi.fn();
      service.onElementsAdded(addHandler);

      service.start();

      // Initially only the app element should be detected
      expect(addHandler).toHaveBeenCalledOnce();
      expect(addHandler.mock.calls[0][0]).toHaveLength(1);

      addHandler.mockClear();

      // Show node_modules - should trigger reconcile and emit the newly visible element
      service.setHideNodeModules(false);

      expect(addHandler).toHaveBeenCalledOnce();
      expect(addHandler.mock.calls[0][0]).toHaveLength(1);
      expect(addHandler.mock.calls[0][0][0].dataLoc).toBe(
        "node_modules/react/index.js:5:0"
      );
    });

    it("emits removal events when re-enabling node_modules filtering", () => {
      const { service, querySelectorAll } = createTestHarness();

      const appEl = createMockElement({ dataLoc: "src/App.tsx:1:0" });
      const nmEl = createMockElement({
        dataLoc: "node_modules/react/index.js:5:0",
      });
      querySelectorAll.setElements([appEl, nmEl]);

      service.setHideNodeModules(false);

      const removeHandler = vi.fn();
      service.onElementsRemoved(removeHandler);

      service.start();

      // Re-enable filtering - the node_modules element should be reported as removed
      service.setHideNodeModules(true);

      expect(removeHandler).toHaveBeenCalledOnce();
      expect(removeHandler).toHaveBeenCalledWith([
        "loc:node_modules/react/index.js:5:0#1",
      ]);
    });

    it("does not trigger reconciliation when not running", () => {
      const { service, querySelectorAll } = createTestHarness();

      querySelectorAll.setElements([]);

      const addHandler = vi.fn();
      service.onElementsAdded(addHandler);

      // Not started - setHideNodeModules should not trigger reconcile
      service.setHideNodeModules(false);

      expect(addHandler).not.toHaveBeenCalled();
      expect(querySelectorAll.fn).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Reconciliation: adding and removing elements via MutationObserver
  // ---------------------------------------------------------------------------

  describe("reconciliation", () => {
    it("detects newly added elements after DOM mutation", () => {
      const { service, querySelectorAll, mutationObserver } = createTestHarness();

      const el1 = createMockElement({ dataLoc: "src/A.tsx:1:0" });
      querySelectorAll.setElements([el1]);

      const addHandler = vi.fn();
      service.onElementsAdded(addHandler);
      service.start();
      addHandler.mockClear();

      // Add a second element to the DOM
      const el2 = createMockElement({ dataLoc: "src/B.tsx:2:0" });
      querySelectorAll.setElements([el1, el2]);

      const mutNode = createMockMutationNode({ hasDataLoc: true });
      mutationObserver.triggerMutations([
        { addedNodes: [mutNode] as unknown as NodeList, removedNodes: [] as unknown as NodeList },
      ]);

      vi.advanceTimersByTime(RECONCILE_DEBOUNCE_MS + 10);

      expect(addHandler).toHaveBeenCalledOnce();
      expect(addHandler.mock.calls[0][0]).toHaveLength(1);
      expect(addHandler.mock.calls[0][0][0].dataLoc).toBe("src/B.tsx:2:0");
    });

    it("detects removed elements after DOM mutation", () => {
      const { service, querySelectorAll, mutationObserver } = createTestHarness();

      const el1 = createMockElement({ dataLoc: "src/A.tsx:1:0" });
      const el2 = createMockElement({ dataLoc: "src/B.tsx:2:0" });
      querySelectorAll.setElements([el1, el2]);

      const removeHandler = vi.fn();
      service.onElementsRemoved(removeHandler);
      service.start();

      // Remove el2 from the DOM
      querySelectorAll.setElements([el1]);

      const mutNode = createMockMutationNode({ hasDataLoc: true });
      mutationObserver.triggerMutations([
        { addedNodes: [] as unknown as NodeList, removedNodes: [mutNode] as unknown as NodeList },
      ]);

      vi.advanceTimersByTime(RECONCILE_DEBOUNCE_MS + 10);

      expect(removeHandler).toHaveBeenCalledOnce();
      expect(removeHandler).toHaveBeenCalledWith(["loc:src/B.tsx:2:0#1"]);
    });

    it("detects simultaneous additions and removals", () => {
      const { service, querySelectorAll, mutationObserver } = createTestHarness();

      const el1 = createMockElement({ dataLoc: "src/Old.tsx:1:0" });
      querySelectorAll.setElements([el1]);

      const addHandler = vi.fn();
      const removeHandler = vi.fn();
      service.onElementsAdded(addHandler);
      service.onElementsRemoved(removeHandler);
      service.start();
      addHandler.mockClear();

      // Replace el1 with el2
      const el2 = createMockElement({ dataLoc: "src/New.tsx:1:0" });
      querySelectorAll.setElements([el2]);

      const mutNode = createMockMutationNode({ hasDataLoc: true });
      mutationObserver.triggerMutations([
        {
          addedNodes: [mutNode] as unknown as NodeList,
          removedNodes: [mutNode] as unknown as NodeList,
        },
      ]);

      vi.advanceTimersByTime(RECONCILE_DEBOUNCE_MS + 10);

      expect(addHandler).toHaveBeenCalledOnce();
      expect(addHandler.mock.calls[0][0][0].dataLoc).toBe("src/New.tsx:1:0");

      expect(removeHandler).toHaveBeenCalledOnce();
      expect(removeHandler).toHaveBeenCalledWith(["loc:src/Old.tsx:1:0#1"]);
    });

    it("does not emit events when the DOM is unchanged between reconciles", () => {
      const { service, querySelectorAll, mutationObserver } = createTestHarness();

      const el = createMockElement({ dataLoc: "src/App.tsx:1:0" });
      querySelectorAll.setElements([el]);

      const addHandler = vi.fn();
      const removeHandler = vi.fn();
      service.onElementsAdded(addHandler);
      service.onElementsRemoved(removeHandler);
      service.start();
      addHandler.mockClear();

      // Trigger mutation but querySelectorAll still returns the same element
      const mutNode = createMockMutationNode({ hasDataLoc: true });
      mutationObserver.triggerMutations([
        { addedNodes: [mutNode] as unknown as NodeList, removedNodes: [] as unknown as NodeList },
      ]);

      vi.advanceTimersByTime(RECONCILE_DEBOUNCE_MS + 10);

      expect(addHandler).not.toHaveBeenCalled();
      expect(removeHandler).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // MutationObserver integration
  // ---------------------------------------------------------------------------

  describe("MutationObserver handling", () => {
    it("ignores mutations with only non-Element nodes (e.g. text nodes)", () => {
      const { service, querySelectorAll, mutationObserver } = createTestHarness();

      querySelectorAll.setElements([]);
      service.start();

      const textNode = createMockTextNode();
      mutationObserver.triggerMutations([
        {
          addedNodes: [textNode] as unknown as NodeList,
          removedNodes: [] as unknown as NodeList,
        },
      ]);

      // Register handler after mutation to verify no debounced reconcile was scheduled
      const addHandler = vi.fn();
      service.onElementsAdded(addHandler);
      vi.advanceTimersByTime(RECONCILE_DEBOUNCE_MS + 10);

      expect(addHandler).not.toHaveBeenCalled();
    });

    it("detects changes via descendant with data-loc in addedNodes", () => {
      const { service, querySelectorAll, mutationObserver } = createTestHarness();

      querySelectorAll.setElements([]);
      service.start();

      const newEl = createMockElement({ dataLoc: "src/New.tsx:1:0" });
      querySelectorAll.setElements([newEl]);

      // Container whose child has data-loc
      const containerNode = createMockMutationNode({ hasChildWithDataLoc: true });
      mutationObserver.triggerMutations([
        {
          addedNodes: [containerNode] as unknown as NodeList,
          removedNodes: [] as unknown as NodeList,
        },
      ]);

      const addHandler = vi.fn();
      service.onElementsAdded(addHandler);
      vi.advanceTimersByTime(RECONCILE_DEBOUNCE_MS + 10);

      expect(addHandler).toHaveBeenCalledOnce();
    });

    it("detects changes in removedNodes that have data-loc", () => {
      const { service, querySelectorAll, mutationObserver } = createTestHarness();

      const el = createMockElement({ dataLoc: "src/App.tsx:1:0" });
      querySelectorAll.setElements([el]);

      const removeHandler = vi.fn();
      service.onElementsRemoved(removeHandler);
      service.start();

      querySelectorAll.setElements([]);

      const removedNode = createMockMutationNode({ hasDataLoc: true });
      mutationObserver.triggerMutations([
        {
          addedNodes: [] as unknown as NodeList,
          removedNodes: [removedNode] as unknown as NodeList,
        },
      ]);

      vi.advanceTimersByTime(RECONCILE_DEBOUNCE_MS + 10);

      expect(removeHandler).toHaveBeenCalledOnce();
    });

    it("debounces rapid mutations into a single reconcile", () => {
      const { service, querySelectorAll, mutationObserver } = createTestHarness();

      querySelectorAll.setElements([]);
      service.start();

      const addHandler = vi.fn();
      service.onElementsAdded(addHandler);

      const mutNode = createMockMutationNode({ hasDataLoc: true });

      // Fire many mutations rapidly
      for (let i = 0; i < 10; i++) {
        mutationObserver.triggerMutations([
          {
            addedNodes: [mutNode] as unknown as NodeList,
            removedNodes: [] as unknown as NodeList,
          },
        ]);
      }

      // Add an element before the debounce fires
      const el = createMockElement({ dataLoc: "src/App.tsx:1:0" });
      querySelectorAll.setElements([el]);

      vi.advanceTimersByTime(RECONCILE_DEBOUNCE_MS + 10);

      // Should only reconcile once despite 10 mutations
      expect(addHandler).toHaveBeenCalledOnce();
    });

    it("scans across multiple mutation records, stopping at first relevant one", () => {
      const { service, querySelectorAll, mutationObserver } = createTestHarness();

      querySelectorAll.setElements([]);
      service.start();

      const addHandler = vi.fn();
      service.onElementsAdded(addHandler);

      const irrelevantNode = createMockMutationNode({
        hasDataLoc: false,
        hasChildWithDataLoc: false,
      });
      const relevantNode = createMockMutationNode({ hasDataLoc: true });

      // First record is irrelevant, second has a data-loc node
      mutationObserver.triggerMutations([
        {
          addedNodes: [irrelevantNode] as unknown as NodeList,
          removedNodes: [] as unknown as NodeList,
        },
        {
          addedNodes: [relevantNode] as unknown as NodeList,
          removedNodes: [] as unknown as NodeList,
        },
      ]);

      const el = createMockElement({ dataLoc: "src/App.tsx:1:0" });
      querySelectorAll.setElements([el]);

      vi.advanceTimersByTime(RECONCILE_DEBOUNCE_MS + 10);

      expect(addHandler).toHaveBeenCalledOnce();
    });

    it("detects relevance from removedNodes when addedNodes are irrelevant", () => {
      const { service, querySelectorAll, mutationObserver } = createTestHarness();

      const el = createMockElement({ dataLoc: "src/App.tsx:1:0" });
      querySelectorAll.setElements([el]);

      const removeHandler = vi.fn();
      service.onElementsRemoved(removeHandler);
      service.start();

      querySelectorAll.setElements([]);

      const irrelevantAdded = createMockMutationNode({
        hasDataLoc: false,
        hasChildWithDataLoc: false,
      });
      const relevantRemoved = createMockMutationNode({ hasDataLoc: true });

      mutationObserver.triggerMutations([
        {
          addedNodes: [irrelevantAdded] as unknown as NodeList,
          removedNodes: [relevantRemoved] as unknown as NodeList,
        },
      ]);

      vi.advanceTimersByTime(RECONCILE_DEBOUNCE_MS + 10);

      expect(removeHandler).toHaveBeenCalledOnce();
    });
  });

  // ---------------------------------------------------------------------------
  // Handler error isolation
  // ---------------------------------------------------------------------------

  describe("handler error isolation", () => {
    it("catches errors in added handlers without affecting other handlers", () => {
      const { service, querySelectorAll } = createTestHarness();

      const failingHandler = vi.fn(() => {
        throw new Error("handler failed");
      });
      const successHandler = vi.fn();

      service.onElementsAdded(failingHandler);
      service.onElementsAdded(successHandler);

      const el = createMockElement({ dataLoc: "src/App.tsx:1:0" });
      querySelectorAll.setElements([el]);

      // Should not throw even though one handler errors
      expect(() => service.start()).not.toThrow();

      expect(failingHandler).toHaveBeenCalledOnce();
      expect(successHandler).toHaveBeenCalledOnce();
    });

    it("catches errors in removed handlers without affecting other handlers", () => {
      const { service, querySelectorAll, mutationObserver } = createTestHarness();

      const el = createMockElement({ dataLoc: "src/App.tsx:1:0" });
      querySelectorAll.setElements([el]);

      const failingHandler = vi.fn(() => {
        throw new Error("removal handler failed");
      });
      const successHandler = vi.fn();

      service.onElementsRemoved(failingHandler);
      service.onElementsRemoved(successHandler);
      service.start();

      // Remove the element
      querySelectorAll.setElements([]);
      const mutNode = createMockMutationNode({ hasDataLoc: true });
      mutationObserver.triggerMutations([
        { addedNodes: [] as unknown as NodeList, removedNodes: [mutNode] as unknown as NodeList },
      ]);
      vi.advanceTimersByTime(RECONCILE_DEBOUNCE_MS + 10);

      expect(failingHandler).toHaveBeenCalledOnce();
      expect(successHandler).toHaveBeenCalledOnce();
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe("edge cases", () => {
    it("handles elements with null getAttribute result", () => {
      const { service, querySelectorAll } = createTestHarness();

      const el = {
        tagName: "DIV",
        hasAttribute: () => true,
        getAttribute: () => null,
        closest: () => null,
        getBoundingClientRect: () => mockRect(),
        querySelector: () => null,
      } as unknown as Element;

      querySelectorAll.setElements([el]);

      const elements = service.getElements();
      expect(elements).toHaveLength(0);
    });

    it("handles 'loc:' with empty body after prefix strip", () => {
      const { service, querySelectorAll } = createTestHarness();

      const el = createMockElement({ dataLoc: "loc:" });
      querySelectorAll.setElements([el]);

      const elements = service.getElements();
      expect(elements).toHaveLength(0);
    });

    it("correctly tracks elements across multiple reconcile cycles", () => {
      const { service, querySelectorAll, mutationObserver } = createTestHarness();

      const addHandler = vi.fn();
      const removeHandler = vi.fn();
      service.onElementsAdded(addHandler);
      service.onElementsRemoved(removeHandler);

      // Cycle 1: start with el1
      const el1 = createMockElement({ dataLoc: "src/A.tsx:1:0" });
      querySelectorAll.setElements([el1]);
      service.start();

      expect(addHandler).toHaveBeenCalledOnce();
      expect(addHandler.mock.calls[0][0]).toHaveLength(1);
      expect(addHandler.mock.calls[0][0][0].dataLoc).toBe("src/A.tsx:1:0");
      addHandler.mockClear();

      // Cycle 2: add el2
      const el2 = createMockElement({ dataLoc: "src/B.tsx:1:0" });
      querySelectorAll.setElements([el1, el2]);

      const mutNode = createMockMutationNode({ hasDataLoc: true });
      mutationObserver.triggerMutations([
        { addedNodes: [mutNode] as unknown as NodeList, removedNodes: [] as unknown as NodeList },
      ]);
      vi.advanceTimersByTime(RECONCILE_DEBOUNCE_MS + 10);

      expect(addHandler).toHaveBeenCalledOnce();
      expect(addHandler.mock.calls[0][0][0].dataLoc).toBe("src/B.tsx:1:0");
      addHandler.mockClear();

      // Cycle 3: remove el1, add el3
      const el3 = createMockElement({ dataLoc: "src/C.tsx:1:0" });
      querySelectorAll.setElements([el2, el3]);

      mutationObserver.triggerMutations([
        {
          addedNodes: [mutNode] as unknown as NodeList,
          removedNodes: [mutNode] as unknown as NodeList,
        },
      ]);
      vi.advanceTimersByTime(RECONCILE_DEBOUNCE_MS + 10);

      expect(addHandler).toHaveBeenCalledOnce();
      expect(addHandler.mock.calls[0][0][0].dataLoc).toBe("src/C.tsx:1:0");
      expect(removeHandler).toHaveBeenCalledOnce();
      expect(removeHandler).toHaveBeenCalledWith(["loc:src/A.tsx:1:0#1"]);
    });

    it("handles mixed data-loc values: some valid, some empty, some node_modules", () => {
      const { service, querySelectorAll } = createTestHarness();

      const valid = createMockElement({ dataLoc: "src/A.tsx:1:0" });
      const empty = createMockElement({ dataLoc: "" });
      const nm = createMockElement({ dataLoc: "node_modules/react/index.js:1:0" });
      const uiLint = createMockElement({ dataLoc: "src/B.tsx:1:0", insideUILint: true });
      const valid2 = createMockElement({ dataLoc: "src/C.tsx:1:0" });

      querySelectorAll.setElements([valid, empty, nm, uiLint, valid2]);

      const elements = service.getElements();

      expect(elements).toHaveLength(2);
      expect(elements[0].dataLoc).toBe("src/A.tsx:1:0");
      expect(elements[1].dataLoc).toBe("src/C.tsx:1:0");
    });
  });
});

// =============================================================================
// Factory function
// =============================================================================

describe("createDOMObserverService()", () => {
  it("returns a DOMObserverService instance with all methods", () => {
    const mockObserver = createMockMutationObserver();
    const service = createDOMObserverService({
      root: createMockElement({ tagName: "body" }),
      MutationObserverImpl: mockObserver.MockClass,
      querySelectorAll: vi.fn(() => [] as unknown as NodeListOf<Element>),
    });

    expect(service).toBeDefined();
    expect(typeof service.start).toBe("function");
    expect(typeof service.stop).toBe("function");
    expect(typeof service.onElementsAdded).toBe("function");
    expect(typeof service.onElementsRemoved).toBe("function");
    expect(typeof service.getElements).toBe("function");
    expect(typeof service.setHideNodeModules).toBe("function");
  });

  it("works without options (uses defaults)", () => {
    const service = createDOMObserverService();
    expect(service).toBeDefined();
  });
});

// =============================================================================
// Additional pure function edge cases
// =============================================================================

describe("pure function edge cases", () => {
  describe("generateElementId", () => {
    it("handles occurrence number 0", () => {
      expect(generateElementId("src/App.tsx:1:0", 0)).toBe("loc:src/App.tsx:1:0#0");
    });

    it("handles large occurrence numbers", () => {
      expect(generateElementId("src/App.tsx:1:0", 9999)).toBe("loc:src/App.tsx:1:0#9999");
    });
  });

  describe("parseDataLoc", () => {
    it("returns null for 'loc:' prefix with only hash suffix", () => {
      const result = parseDataLoc("loc:#5");
      expect(result).toBeNull();
    });

    it("preserves non-loc: strings with hash characters", () => {
      const result = parseDataLoc("src/page#section.tsx:10:5");
      expect(result).toBe("src/page#section.tsx:10:5");
    });
  });

  describe("shouldFilterPath", () => {
    it("matches node_modules anywhere in the path", () => {
      expect(shouldFilterPath("/deep/nested/node_modules/pkg/file.js", true)).toBe(true);
    });

    it("does not false-positive on paths without node_modules", () => {
      expect(shouldFilterPath("src/modules/utils.ts", true)).toBe(false);
    });
  });
});
