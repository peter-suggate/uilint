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
  buildVisionAnalysisPayload,
  captureScreenshot,
  captureScreenshotRegion,
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

describe("buildVisionAnalysisPayload", () => {
  it("builds payload with required fields", () => {
    const manifest: ElementManifest[] = [
      {
        id: "btn-1",
        text: "Submit",
        dataLoc: "app/page.tsx:10:5",
        rect: { x: 100, y: 200, width: 120, height: 40 },
        tagName: "button",
        role: "button",
      },
    ];

    const payload = buildVisionAnalysisPayload({
      manifest,
      route: "/checkout",
    });

    expect(payload.type).toBe("vision:analyze");
    expect(payload.route).toBe("/checkout");
    expect(payload.manifest).toEqual(manifest);
    expect(payload.timestamp).toBeTypeOf("number");
    expect(payload.screenshot).toBeUndefined();
    expect(payload.screenshotFile).toBeUndefined();
  });

  it("includes screenshotDataUrl when provided", () => {
    const payload = buildVisionAnalysisPayload({
      manifest: [],
      route: "/",
      screenshotDataUrl: "data:image/png;base64,abc123",
    });

    expect(payload.screenshot).toBe("data:image/png;base64,abc123");
  });

  it("includes screenshotFile when provided", () => {
    const payload = buildVisionAnalysisPayload({
      manifest: [],
      route: "/dashboard",
      screenshotFile: "uilint-dashboard-2024-01-15.png",
    });

    expect(payload.screenshotFile).toBe("uilint-dashboard-2024-01-15.png");
  });

  it("includes both screenshot and screenshotFile when both provided", () => {
    const payload = buildVisionAnalysisPayload({
      manifest: [],
      route: "/settings",
      screenshotDataUrl: "data:image/png;base64,xyz789",
      screenshotFile: "uilint-settings-2024-01-15.png",
    });

    expect(payload.screenshot).toBe("data:image/png;base64,xyz789");
    expect(payload.screenshotFile).toBe("uilint-settings-2024-01-15.png");
  });

  it("timestamp is close to current time", () => {
    const before = Date.now();
    const payload = buildVisionAnalysisPayload({
      manifest: [],
      route: "/",
    });
    const after = Date.now();

    expect(payload.timestamp).toBeGreaterThanOrEqual(before);
    expect(payload.timestamp).toBeLessThanOrEqual(after);
  });
});

describe("captureScreenshot", () => {
  // Note: captureScreenshot uses html-to-image which is mocked at the top
  let originalDocument: typeof globalThis.document;

  beforeEach(() => {
    originalDocument = globalThis.document;
  });

  afterEach(() => {
    globalThis.document = originalDocument;
    vi.restoreAllMocks();
  });

  it("returns a data URL from html-to-image", async () => {
    const dom = new JSDOM(`<!DOCTYPE html><html><body><div>Test</div></body></html>`);
    globalThis.document = dom.window.document as unknown as Document;

    const dataUrl = await captureScreenshot();

    expect(dataUrl).toBe("data:image/png;base64,mockPngData");
  });

  it("throws error with CORS hint when cross-origin error occurs", async () => {
    const htmlToImage = await import("html-to-image");
    vi.mocked(htmlToImage.toPng).mockRejectedValueOnce(
      new Error("The canvas has been tainted by cross-origin data")
    );

    const dom = new JSDOM(`<!DOCTYPE html><html><body><div>Test</div></body></html>`);
    globalThis.document = dom.window.document as unknown as Document;

    await expect(captureScreenshot()).rejects.toThrow(/cross-origin images/);
  });

  it("throws error without CORS hint for non-CORS errors", async () => {
    const htmlToImage = await import("html-to-image");
    vi.mocked(htmlToImage.toPng).mockRejectedValueOnce(new Error("Canvas rendering failed"));

    const dom = new JSDOM(`<!DOCTYPE html><html><body><div>Test</div></body></html>`);
    globalThis.document = dom.window.document as unknown as Document;

    await expect(captureScreenshot()).rejects.toThrow("Screenshot capture failed");
    try {
      await captureScreenshot();
    } catch (e) {
      expect((e as Error).message).not.toContain("cross-origin");
    }
  });

  it("handles non-Error throws gracefully", async () => {
    const htmlToImage = await import("html-to-image");
    vi.mocked(htmlToImage.toPng).mockRejectedValueOnce("string error");

    const dom = new JSDOM(`<!DOCTYPE html><html><body><div>Test</div></body></html>`);
    globalThis.document = dom.window.document as unknown as Document;

    await expect(captureScreenshot()).rejects.toThrow("Screenshot capture failed");
  });

  it("passes filter function to html-to-image", async () => {
    const htmlToImage = await import("html-to-image");
    let filterFn: ((node: Node) => boolean) | undefined;

    vi.mocked(htmlToImage.toPng).mockImplementationOnce(async (_node, options) => {
      filterFn = options?.filter;
      return "data:image/png;base64,mockPngData";
    });

    const dom = new JSDOM(`<!DOCTYPE html><html><body><div>Test</div></body></html>`);
    globalThis.document = dom.window.document as unknown as Document;

    await captureScreenshot();

    // Verify that a filter function is passed to html-to-image
    expect(filterFn).toBeDefined();
    expect(typeof filterFn).toBe("function");
  });

  it("uses pixelRatio 1 and cacheBust true for performance", async () => {
    const htmlToImage = await import("html-to-image");
    let capturedOptions: { pixelRatio?: number; cacheBust?: boolean } | undefined;

    vi.mocked(htmlToImage.toPng).mockImplementationOnce(async (_node, options) => {
      capturedOptions = options;
      return "data:image/png;base64,mockPngData";
    });

    const dom = new JSDOM(`<!DOCTYPE html><html><body><div>Test</div></body></html>`);
    globalThis.document = dom.window.document as unknown as Document;

    await captureScreenshot();

    expect(capturedOptions?.pixelRatio).toBe(1);
    expect(capturedOptions?.cacheBust).toBe(true);
  });
});

describe("captureScreenshotRegion", () => {
  // Note: This relies on the html-to-image mock and canvas operations
  let originalDocument: typeof globalThis.document;
  let originalWindow: typeof globalThis.window;

  beforeEach(() => {
    originalDocument = globalThis.document;
    originalWindow = globalThis.window;
  });

  afterEach(() => {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  });

  it("captures and crops a region of the page", async () => {
    const dom = new JSDOM(`<!DOCTYPE html><html><body><div>Test</div></body></html>`);
    globalThis.document = dom.window.document as unknown as Document;

    // Mock window scroll properties
    Object.defineProperty(globalThis, "window", {
      value: {
        scrollX: 0,
        scrollY: 0,
        pageXOffset: 0,
        pageYOffset: 0,
      },
      writable: true,
    });

    // Mock document.createElement to return a mock canvas
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: () => {},
      }),
      toDataURL: () => "data:image/png;base64,croppedRegionData",
    };
    const originalCreateElement = globalThis.document.createElement.bind(globalThis.document);
    globalThis.document.createElement = ((tagName: string) => {
      if (tagName === "canvas") {
        return mockCanvas as unknown as HTMLCanvasElement;
      }
      return originalCreateElement(tagName);
    }) as typeof document.createElement;

    // Mock Image constructor
    const originalImage = globalThis.Image;
    const globalThisWithImage = globalThis as typeof globalThis & {
      Image: typeof Image;
    };
    globalThisWithImage.Image = class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      src = "";

      constructor() {
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
    } as unknown as typeof Image;

    const dataUrl = await captureScreenshotRegion({
      x: 100,
      y: 100,
      width: 200,
      height: 150,
    });

    expect(dataUrl).toBe("data:image/png;base64,croppedRegionData");
    globalThisWithImage.Image = originalImage;
  });

  it("handles scroll offset correctly", async () => {
    const dom = new JSDOM(`<!DOCTYPE html><html><body><div>Test</div></body></html>`);
    globalThis.document = dom.window.document as unknown as Document;

    // Mock window with scroll offset
    Object.defineProperty(globalThis, "window", {
      value: {
        scrollX: 50,
        scrollY: 100,
        pageXOffset: 50,
        pageYOffset: 100,
      },
      writable: true,
    });

    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: vi.fn(),
      }),
      toDataURL: () => "data:image/png;base64,croppedData",
    };
    const originalCreateElement = globalThis.document.createElement.bind(globalThis.document);
    globalThis.document.createElement = ((tagName: string) => {
      if (tagName === "canvas") {
        return mockCanvas as unknown as HTMLCanvasElement;
      }
      return originalCreateElement(tagName);
    }) as typeof document.createElement;

    const originalImage = globalThis.Image;
    const globalThisWithImage = globalThis as typeof globalThis & {
      Image: typeof Image;
    };
    globalThisWithImage.Image = class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      src = "";

      constructor() {
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
    } as unknown as typeof Image;

    const dataUrl = await captureScreenshotRegion({
      x: 100,
      y: 100,
      width: 200,
      height: 150,
    });

    expect(dataUrl).toBe("data:image/png;base64,croppedData");
    globalThisWithImage.Image = originalImage;
  });

  it("throws error with CORS hint when cross-origin error occurs", async () => {
    const htmlToImage = await import("html-to-image");
    vi.mocked(htmlToImage.toPng).mockRejectedValueOnce(
      new Error("Failed due to CORS policy")
    );

    const dom = new JSDOM(`<!DOCTYPE html><html><body><div>Test</div></body></html>`);
    globalThis.document = dom.window.document as unknown as Document;

    Object.defineProperty(globalThis, "window", {
      value: { scrollX: 0, scrollY: 0, pageXOffset: 0, pageYOffset: 0 },
      writable: true,
    });

    await expect(
      captureScreenshotRegion({ x: 0, y: 0, width: 100, height: 100 })
    ).rejects.toThrow(/cross-origin images/);
  });

  it("throws error without CORS hint for non-CORS errors", async () => {
    const htmlToImage = await import("html-to-image");
    vi.mocked(htmlToImage.toPng).mockRejectedValueOnce(new Error("Memory limit exceeded"));

    const dom = new JSDOM(`<!DOCTYPE html><html><body><div>Test</div></body></html>`);
    globalThis.document = dom.window.document as unknown as Document;

    Object.defineProperty(globalThis, "window", {
      value: { scrollX: 0, scrollY: 0, pageXOffset: 0, pageYOffset: 0 },
      writable: true,
    });

    await expect(
      captureScreenshotRegion({ x: 0, y: 0, width: 100, height: 100 })
    ).rejects.toThrow("Screenshot capture failed");
    try {
      await captureScreenshotRegion({ x: 0, y: 0, width: 100, height: 100 });
    } catch (e) {
      expect((e as Error).message).not.toContain("cross-origin");
    }
  });
});
