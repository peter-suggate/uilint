/**
 * Unit tests for vision-capture module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { JSDOM } from "jsdom";

// We need to mock html-to-image since it requires a real DOM
vi.mock("html-to-image", () => ({
  toPng: vi.fn().mockResolvedValue("data:image/png;base64,mockPngData"),
  toJpeg: vi.fn().mockResolvedValue("data:image/jpeg;base64,mockJpegData"),
}));

import {
  collectElementManifest,
  matchIssuesToManifest,
  generateTimestamp,
  getCurrentRoute,
  type ElementManifest,
  type VisionIssue,
} from "./vision-capture.js";

describe("collectElementManifest", () => {
  let dom: JSDOM;
  let originalDocument: typeof globalThis.document;
  let originalWindow: typeof globalThis.window;

  beforeEach(() => {
    // Save originals
    originalDocument = globalThis.document;
    originalWindow = globalThis.window;
  });

  afterEach(() => {
    // Restore globals
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    dom?.window.close();
  });

  function setupDOM(html: string): Element {
    dom = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, {
      runScripts: "dangerously",
    });

    // Setup globals
    globalThis.document = dom.window.document as unknown as Document;
    globalThis.window = dom.window as unknown as typeof globalThis.window;

    // Mock getComputedStyle for visibility checks
    (globalThis.window as unknown as { getComputedStyle: typeof window.getComputedStyle }).getComputedStyle = vi.fn().mockReturnValue({
      display: "block",
      visibility: "visible",
      opacity: "1",
    });

    // Mock getBoundingClientRect for all elements
    const body = dom.window.document.body;
    const allElements = body.querySelectorAll("*");
    allElements.forEach((el, index) => {
      (el as HTMLElement).getBoundingClientRect = vi.fn().mockReturnValue({
        x: 10 + index * 100,
        y: 10 + index * 50,
        width: 100,
        height: 40,
        top: 10 + index * 50,
        left: 10 + index * 100,
        right: 110 + index * 100,
        bottom: 50 + index * 50,
      });
    });

    // Mock innerWidth/innerHeight
    Object.defineProperty(globalThis.window, "innerWidth", { value: 1920 });
    Object.defineProperty(globalThis.window, "innerHeight", { value: 1080 });

    return body;
  }

  it("collects elements with data-loc attributes", () => {
    const body = setupDOM(`
      <button data-loc="app/page.tsx:10:5">Submit</button>
      <p data-loc="app/page.tsx:15:5">Hello World</p>
    `);

    const manifest = collectElementManifest(body);

    expect(manifest).toHaveLength(2);
    expect(manifest[0].dataLoc).toBe("app/page.tsx:10:5");
    expect(manifest[0].tagName).toBe("button");
    expect(manifest[0].role).toBe("button");

    expect(manifest[1].dataLoc).toBe("app/page.tsx:15:5");
    expect(manifest[1].tagName).toBe("p");
  });

  it("deduplicates list items with same data-loc", () => {
    const body = setupDOM(`
      <ul>
        <li data-loc="app/todos/page.tsx:15:6">Buy groceries</li>
        <li data-loc="app/todos/page.tsx:15:6">Walk the dog</li>
        <li data-loc="app/todos/page.tsx:15:6">Review PR</li>
        <li data-loc="app/todos/page.tsx:15:6">Write tests</li>
        <li data-loc="app/todos/page.tsx:15:6">Deploy app</li>
        <li data-loc="app/todos/page.tsx:15:6">Send email</li>
        <li data-loc="app/todos/page.tsx:15:6">Read docs</li>
        <li data-loc="app/todos/page.tsx:15:6">Fix bug</li>
        <li data-loc="app/todos/page.tsx:15:6">Update deps</li>
        <li data-loc="app/todos/page.tsx:15:6">Clean up</li>
      </ul>
    `);

    const manifest = collectElementManifest(body);

    // Should have max 3 entries for the same data-loc (dedup limit)
    const todoItems = manifest.filter((m) =>
      m.dataLoc.includes("todos/page.tsx")
    );
    expect(todoItems).toHaveLength(3);

    // First entry should have instanceCount showing total
    expect(todoItems[0].instanceCount).toBe(10);
  });

  it("infers correct roles for semantic elements", () => {
    const body = setupDOM(`
      <button data-loc="app/page.tsx:1:1">Click</button>
      <a href="#" data-loc="app/page.tsx:2:1">Link</a>
      <h1 data-loc="app/page.tsx:3:1">Title</h1>
      <input type="text" data-loc="app/page.tsx:4:1" placeholder="Enter text" />
      <nav data-loc="app/page.tsx:5:1">Nav</nav>
    `);

    const manifest = collectElementManifest(body);

    expect(manifest.find((m) => m.tagName === "button")?.role).toBe("button");
    expect(manifest.find((m) => m.tagName === "a")?.role).toBe("link");
    expect(manifest.find((m) => m.tagName === "h1")?.role).toBe("heading");
    expect(manifest.find((m) => m.tagName === "input")?.role).toBe("textbox");
    expect(manifest.find((m) => m.tagName === "nav")?.role).toBe("navigation");
  });

  it("skips script and style elements", () => {
    const body = setupDOM(`
      <script data-loc="app/page.tsx:1:1">console.log('test')</script>
      <style data-loc="app/page.tsx:2:1">.test { color: red; }</style>
      <button data-loc="app/page.tsx:4:1">Valid</button>
    `);

    const manifest = collectElementManifest(body);

    // Script and style should be skipped, button should be included
    expect(manifest.find((m) => m.tagName === "script")).toBeUndefined();
    expect(manifest.find((m) => m.tagName === "style")).toBeUndefined();
    expect(manifest.find((m) => m.tagName === "button")).toBeDefined();
  });

  it("respects custom maxSamplesPerDataLoc via constant", () => {
    // The module uses MAX_INSTANCES_PER_DATALOC = 3
    const body = setupDOM(`
      <ul>
        <li data-loc="app/list.tsx:5:4">Item 1</li>
        <li data-loc="app/list.tsx:5:4">Item 2</li>
        <li data-loc="app/list.tsx:5:4">Item 3</li>
        <li data-loc="app/list.tsx:5:4">Item 4</li>
        <li data-loc="app/list.tsx:5:4">Item 5</li>
      </ul>
    `);

    const manifest = collectElementManifest(body);

    // Should have max 3 entries due to MAX_INSTANCES_PER_DATALOC
    expect(manifest).toHaveLength(3);
    expect(manifest[0].instanceCount).toBe(5);
  });

  it("handles nested elements correctly", () => {
    const body = setupDOM(`
      <div data-loc="app/page.tsx:10:5">
        <span data-loc="app/page.tsx:11:7">Nested Text</span>
      </div>
    `);

    const manifest = collectElementManifest(body);

    // Both elements should be captured as they have different data-loc
    expect(manifest).toHaveLength(2);
    expect(manifest.map((m) => m.dataLoc)).toContain("app/page.tsx:10:5");
    expect(manifest.map((m) => m.dataLoc)).toContain("app/page.tsx:11:7");
  });

  it("skips elements without data-loc", () => {
    const body = setupDOM(`
      <button>No data-loc</button>
      <button data-loc="app/page.tsx:10:5">Has data-loc</button>
      <p>Another without</p>
    `);

    const manifest = collectElementManifest(body);

    expect(manifest).toHaveLength(1);
  });

  it("generates unique IDs for each entry", () => {
    const body = setupDOM(`
      <button data-loc="app/page.tsx:10:5">Button 1</button>
      <button data-loc="app/page.tsx:15:5">Button 2</button>
      <button data-loc="app/page.tsx:20:5">Button 3</button>
    `);

    const manifest = collectElementManifest(body);

    const ids = manifest.map((m) => m.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

describe("matchIssuesToManifest", () => {
  const manifest: ElementManifest[] = [
    {
      id: "btn-1",
      text: "Submit Order",
      dataLoc: "app/checkout.tsx:45:8",
      rect: { x: 100, y: 200, width: 120, height: 40 },
      tagName: "button",
      role: "button",
    },
    {
      id: "btn-2",
      text: "Cancel",
      dataLoc: "app/checkout.tsx:50:8",
      rect: { x: 230, y: 200, width: 80, height: 40 },
      tagName: "button",
      role: "button",
    },
    {
      id: "heading-1",
      text: "Shopping Cart",
      dataLoc: "app/checkout.tsx:10:4",
      rect: { x: 100, y: 50, width: 300, height: 48 },
      tagName: "h1",
      role: "heading",
    },
  ];

  it("matches exact text", () => {
    const issues: VisionIssue[] = [
      {
        elementText: "Submit Order",
        message: "Button has inconsistent padding",
        category: "spacing",
        severity: "warning",
      },
    ];

    const matched = matchIssuesToManifest(issues, manifest);

    expect(matched[0].dataLoc).toBe("app/checkout.tsx:45:8");
    expect(matched[0].elementId).toBe("btn-1");
  });

  it("matches case-insensitive", () => {
    const issues: VisionIssue[] = [
      {
        elementText: "submit order",
        message: "Button has inconsistent padding",
        category: "spacing",
        severity: "warning",
      },
    ];

    const matched = matchIssuesToManifest(issues, manifest);

    expect(matched[0].dataLoc).toBe("app/checkout.tsx:45:8");
  });

  it("matches partial text (search in entry)", () => {
    const issues: VisionIssue[] = [
      {
        elementText: "Cart",
        message: "Heading misaligned",
        category: "alignment",
        severity: "warning",
      },
    ];

    const matched = matchIssuesToManifest(issues, manifest);

    expect(matched[0].dataLoc).toBe("app/checkout.tsx:10:4");
  });

  it("matches partial text (entry in search)", () => {
    const issues: VisionIssue[] = [
      {
        elementText: "Click Cancel to go back",
        message: "Button style issue",
        category: "consistency",
        severity: "info",
      },
    ];

    const matched = matchIssuesToManifest(issues, manifest);

    expect(matched[0].dataLoc).toBe("app/checkout.tsx:50:8");
  });

  it("returns issue unchanged if no match found", () => {
    const issues: VisionIssue[] = [
      {
        elementText: "Non-existent element",
        message: "Some issue",
        category: "other",
        severity: "info",
      },
    ];

    const matched = matchIssuesToManifest(issues, manifest);

    expect(matched[0].dataLoc).toBeUndefined();
    expect(matched[0].elementId).toBeUndefined();
  });
});

describe("generateTimestamp", () => {
  it("generates ISO-like timestamp with dashes instead of colons", () => {
    const timestamp = generateTimestamp();

    // Should match pattern like: 2026-01-11T10-30-45-123Z
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/);
  });
});

describe("getCurrentRoute", () => {
  let originalWindow: typeof globalThis.window;

  beforeEach(() => {
    originalWindow = globalThis.window;
  });

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  it("returns normalized path", () => {
    const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
      url: "http://localhost:3000/profile/settings/",
    });
    globalThis.window = dom.window as unknown as typeof globalThis.window;

    const route = getCurrentRoute();

    // Should remove trailing slash
    expect(route).toBe("/profile/settings");
  });

  it("returns / for root path", () => {
    const dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`, {
      url: "http://localhost:3000/",
    });
    globalThis.window = dom.window as unknown as typeof globalThis.window;

    const route = getCurrentRoute();

    expect(route).toBe("/");
  });
});
