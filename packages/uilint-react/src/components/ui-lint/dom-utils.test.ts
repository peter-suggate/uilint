/**
 * Unit tests for dom-utils module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { JSDOM } from "jsdom";
import {
  getSourceFromDataLoc,
  isNodeModulesPath,
  getDisplayName,
  groupBySourceFile,
  identifyTopLevelElements,
  buildEditorUrl,
  scanDOMForSources,
  cleanupDataAttributes,
  getElementById,
  updateElementRects,
} from "./dom-utils";
import type { ScannedElement, SourceLocation } from "./types";

describe("getSourceFromDataLoc", () => {
  let dom: JSDOM;
  let originalDocument: typeof globalThis.document;

  beforeEach(() => {
    originalDocument = globalThis.document;
    dom = new JSDOM(`<!DOCTYPE html><html><body></body></html>`);
    globalThis.document = dom.window.document as unknown as Document;
  });

  afterEach(() => {
    globalThis.document = originalDocument;
    dom?.window.close();
  });

  it("parses standard path:line:column format", () => {
    const el = document.createElement("div");
    el.setAttribute("data-loc", "app/page.tsx:10:5");

    const result = getSourceFromDataLoc(el);

    expect(result).toEqual({
      fileName: "app/page.tsx",
      lineNumber: 10,
      columnNumber: 5,
    });
  });

  it("parses legacy path:line format", () => {
    const el = document.createElement("div");
    el.setAttribute("data-loc", "app/page.tsx:15");

    const result = getSourceFromDataLoc(el);

    expect(result).toEqual({
      fileName: "app/page.tsx",
      lineNumber: 15,
    });
  });

  it("parses runtime ID format loc:path:line:column#occurrence", () => {
    const el = document.createElement("div");
    el.setAttribute("data-loc", "loc:app/page.tsx:20:3#1");

    const result = getSourceFromDataLoc(el);

    expect(result).toEqual({
      fileName: "app/page.tsx",
      lineNumber: 20,
      columnNumber: 3,
    });
  });

  it("handles Windows paths with colons", () => {
    const el = document.createElement("div");
    el.setAttribute("data-loc", "C:/Users/dev/project/app/page.tsx:10:5");

    const result = getSourceFromDataLoc(el);

    expect(result).toEqual({
      fileName: "C:/Users/dev/project/app/page.tsx",
      lineNumber: 10,
      columnNumber: 5,
    });
  });

  it("returns null for elements without data-loc", () => {
    const el = document.createElement("div");

    const result = getSourceFromDataLoc(el);

    expect(result).toBeNull();
  });

  it("returns null for invalid format with single part", () => {
    const el = document.createElement("div");
    el.setAttribute("data-loc", "invalid");

    const result = getSourceFromDataLoc(el);

    expect(result).toBeNull();
  });

  it("returns null for empty filename", () => {
    const el = document.createElement("div");
    el.setAttribute("data-loc", ":10:5");

    const result = getSourceFromDataLoc(el);

    expect(result).toBeNull();
  });
});

describe("isNodeModulesPath", () => {
  it("returns true for paths containing node_modules", () => {
    expect(isNodeModulesPath("node_modules/react/index.js")).toBe(true);
    expect(isNodeModulesPath("./node_modules/@scope/pkg/index.ts")).toBe(true);
    expect(isNodeModulesPath("/app/node_modules/lodash/index.js")).toBe(true);
  });

  it("returns false for paths without node_modules", () => {
    expect(isNodeModulesPath("app/page.tsx")).toBe(false);
    expect(isNodeModulesPath("src/components/Button.tsx")).toBe(false);
    expect(isNodeModulesPath("./lib/utils.ts")).toBe(false);
  });
});

describe("getDisplayName", () => {
  it("extracts filename from path", () => {
    expect(getDisplayName("app/components/Button.tsx")).toBe("Button.tsx");
    expect(getDisplayName("src/index.ts")).toBe("index.ts");
  });

  it("handles paths with many segments", () => {
    expect(getDisplayName("a/b/c/d/e/file.tsx")).toBe("file.tsx");
  });

  it("returns input for single filename", () => {
    expect(getDisplayName("file.tsx")).toBe("file.tsx");
  });

  it("handles empty path", () => {
    expect(getDisplayName("")).toBe("");
  });

  it("handles trailing slash - falls back to full path", () => {
    // When the last part is empty, the function returns the original path
    expect(getDisplayName("some/path/")).toBe("some/path/");
  });
});

describe("groupBySourceFile", () => {
  // Use a mock element object since groupBySourceFile doesn't call DOM methods on it
  const createMockElement = (id: string, fileName: string, lineNumber: number): ScannedElement => ({
    id,
    element: {} as unknown as Element,
    tagName: "div",
    className: "",
    source: { fileName, lineNumber },
    rect: { x: 0, y: 0, width: 100, height: 50 } as DOMRect,
  });

  it("groups elements by their source file", () => {
    const elements: ScannedElement[] = [
      createMockElement("1", "app/page.tsx", 10),
      createMockElement("2", "app/page.tsx", 20),
      createMockElement("3", "components/Button.tsx", 5),
    ];

    const result = groupBySourceFile(elements);

    expect(result).toHaveLength(2);
    const pageFile = result.find((f) => f.path === "app/page.tsx");
    const buttonFile = result.find((f) => f.path === "components/Button.tsx");

    expect(pageFile?.elements).toHaveLength(2);
    expect(buttonFile?.elements).toHaveLength(1);
  });

  it("assigns unique colors to each file", () => {
    const elements: ScannedElement[] = [
      createMockElement("1", "file1.tsx", 1),
      createMockElement("2", "file2.tsx", 1),
      createMockElement("3", "file3.tsx", 1),
    ];

    const result = groupBySourceFile(elements);

    const colors = result.map((f) => f.color);
    expect(new Set(colors).size).toBe(3); // All different colors
  });

  it("sorts files by element count (most first)", () => {
    const elements: ScannedElement[] = [
      createMockElement("1", "small.tsx", 1),
      createMockElement("2", "large.tsx", 1),
      createMockElement("3", "large.tsx", 2),
      createMockElement("4", "large.tsx", 3),
    ];

    const result = groupBySourceFile(elements);

    expect(result[0].path).toBe("large.tsx");
    expect(result[0].elements).toHaveLength(3);
    expect(result[1].path).toBe("small.tsx");
    expect(result[1].elements).toHaveLength(1);
  });

  it("sets displayName from path", () => {
    const elements: ScannedElement[] = [
      createMockElement("1", "app/components/Header.tsx", 1),
    ];

    const result = groupBySourceFile(elements);

    expect(result[0].displayName).toBe("Header.tsx");
  });

  it("handles empty array", () => {
    const result = groupBySourceFile([]);

    expect(result).toHaveLength(0);
  });

  it("skips elements without source", () => {
    const elements: ScannedElement[] = [
      {
        id: "1",
        element: {} as unknown as Element,
        tagName: "div",
        className: "",
        source: undefined as unknown as SourceLocation,
        rect: { x: 0, y: 0, width: 100, height: 50 } as DOMRect,
      },
      createMockElement("2", "valid.tsx", 1),
    ];

    const result = groupBySourceFile(elements);

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe("valid.tsx");
  });
});

describe("identifyTopLevelElements", () => {
  const createMockElement = (
    id: string,
    fileName: string,
    lineNumber: number,
    columnNumber?: number
  ): ScannedElement => ({
    id,
    // Use a mock element object since identifyTopLevelElements doesn't use it
    element: {} as unknown as Element,
    tagName: "div",
    className: "",
    source: { fileName, lineNumber, columnNumber },
    rect: { x: 0, y: 0, width: 100, height: 50 } as DOMRect,
  });

  it("identifies earliest element by line number for each file", () => {
    const elements: ScannedElement[] = [
      createMockElement("elem-later", "app/page.tsx", 20),
      createMockElement("elem-first", "app/page.tsx", 5),
      createMockElement("elem-middle", "app/page.tsx", 10),
    ];

    const result = identifyTopLevelElements(elements);

    expect(result.get("app/page.tsx")).toBe("elem-first");
  });

  it("uses column number for tie-breaking", () => {
    const elements: ScannedElement[] = [
      createMockElement("elem-col-10", "app/page.tsx", 5, 10),
      createMockElement("elem-col-2", "app/page.tsx", 5, 2),
      createMockElement("elem-col-5", "app/page.tsx", 5, 5),
    ];

    const result = identifyTopLevelElements(elements);

    expect(result.get("app/page.tsx")).toBe("elem-col-2");
  });

  it("handles multiple files independently", () => {
    const elements: ScannedElement[] = [
      createMockElement("page-later", "app/page.tsx", 20),
      createMockElement("page-first", "app/page.tsx", 5),
      createMockElement("button-later", "components/Button.tsx", 15),
      createMockElement("button-first", "components/Button.tsx", 3),
    ];

    const result = identifyTopLevelElements(elements);

    expect(result.get("app/page.tsx")).toBe("page-first");
    expect(result.get("components/Button.tsx")).toBe("button-first");
  });

  it("handles empty array", () => {
    const result = identifyTopLevelElements([]);

    expect(result.size).toBe(0);
  });

  it("handles single element", () => {
    const elements: ScannedElement[] = [
      createMockElement("only-one", "app/page.tsx", 10),
    ];

    const result = identifyTopLevelElements(elements);

    expect(result.get("app/page.tsx")).toBe("only-one");
  });
});

describe("buildEditorUrl", () => {
  it("builds cursor URL with line and column", () => {
    const source: SourceLocation = {
      fileName: "app/page.tsx",
      lineNumber: 10,
      columnNumber: 5,
    };

    const url = buildEditorUrl(source, "cursor");

    expect(url).toBe("cursor://file/app%2Fpage.tsx:10:5");
  });

  it("builds vscode URL with line and column", () => {
    const source: SourceLocation = {
      fileName: "app/page.tsx",
      lineNumber: 10,
      columnNumber: 5,
    };

    const url = buildEditorUrl(source, "vscode");

    expect(url).toBe("vscode://file/app%2Fpage.tsx:10:5");
  });

  it("defaults column to 1 when not provided", () => {
    const source: SourceLocation = {
      fileName: "app/page.tsx",
      lineNumber: 10,
    };

    const url = buildEditorUrl(source, "cursor");

    expect(url).toBe("cursor://file/app%2Fpage.tsx:10:1");
  });

  it("defaults editor to cursor", () => {
    const source: SourceLocation = {
      fileName: "app/page.tsx",
      lineNumber: 10,
      columnNumber: 5,
    };

    const url = buildEditorUrl(source);

    expect(url).toBe("cursor://file/app%2Fpage.tsx:10:5");
  });

  it("prepends workspace root for relative paths", () => {
    const source: SourceLocation = {
      fileName: "app/page.tsx",
      lineNumber: 10,
      columnNumber: 5,
    };

    const url = buildEditorUrl(source, "cursor", "/home/user/project");

    expect(url).toBe("cursor://file/%2Fhome%2Fuser%2Fproject%2Fapp%2Fpage.tsx:10:5");
  });

  it("does not prepend workspace root for absolute paths", () => {
    const source: SourceLocation = {
      fileName: "/absolute/path/file.tsx",
      lineNumber: 10,
      columnNumber: 5,
    };

    const url = buildEditorUrl(source, "cursor", "/workspace");

    expect(url).toBe("cursor://file/%2Fabsolute%2Fpath%2Ffile.tsx:10:5");
  });

  it("handles workspace root with trailing slash", () => {
    const source: SourceLocation = {
      fileName: "app/page.tsx",
      lineNumber: 10,
      columnNumber: 5,
    };

    const url = buildEditorUrl(source, "cursor", "/home/user/project/");

    expect(url).toBe("cursor://file/%2Fhome%2Fuser%2Fproject%2Fapp%2Fpage.tsx:10:5");
  });
});

describe("scanDOMForSources", () => {
  let dom: JSDOM;
  let originalDocument: typeof globalThis.document;
  let originalWindow: typeof globalThis.window;

  beforeEach(() => {
    originalDocument = globalThis.document;
    originalWindow = globalThis.window;
  });

  afterEach(() => {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    dom?.window.close();
  });

  function setupDOM(html: string): Element {
    dom = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, {
      runScripts: "dangerously",
    });

    globalThis.document = dom.window.document as unknown as Document;
    globalThis.window = dom.window as unknown as typeof globalThis.window;

    // Mock getComputedStyle
    (globalThis.window as { getComputedStyle: typeof window.getComputedStyle }).getComputedStyle = vi.fn().mockReturnValue({
      display: "block",
      visibility: "visible",
    });

    // Mock getBoundingClientRect for all elements
    const body = dom.window.document.body;
    const allElements = body.querySelectorAll("*");
    allElements.forEach((el, index) => {
      (el as HTMLElement).getBoundingClientRect = vi.fn().mockReturnValue({
        x: 10 + index * 100,
        y: 10,
        width: 100,
        height: 40,
        top: 10,
        left: 10 + index * 100,
        right: 110 + index * 100,
        bottom: 50,
      });
    });

    return body;
  }

  it("scans elements with data-loc attributes", () => {
    const body = setupDOM(`
      <button data-loc="app/page.tsx:10:5">Click me</button>
      <p data-loc="app/page.tsx:15:5">Hello</p>
    `);

    const elements = scanDOMForSources(body);

    expect(elements).toHaveLength(2);
    expect(elements[0].source.fileName).toBe("app/page.tsx");
    expect(elements[0].source.lineNumber).toBe(10);
  });

  it("filters out node_modules paths by default", () => {
    const body = setupDOM(`
      <button data-loc="app/page.tsx:10:5">App button</button>
      <button data-loc="node_modules/pkg/index.tsx:5:1">Library button</button>
    `);

    const elements = scanDOMForSources(body, true);

    expect(elements).toHaveLength(1);
    expect(elements[0].source.fileName).toBe("app/page.tsx");
  });

  it("includes node_modules paths when hideNodeModules is false", () => {
    const body = setupDOM(`
      <button data-loc="app/page.tsx:10:5">App button</button>
      <button data-loc="node_modules/pkg/index.tsx:5:1">Library button</button>
    `);

    const elements = scanDOMForSources(body, false);

    expect(elements).toHaveLength(2);
  });

  it("assigns unique IDs with occurrence numbers for duplicate data-loc", () => {
    const body = setupDOM(`
      <li data-loc="app/list.tsx:10:5">Item 1</li>
      <li data-loc="app/list.tsx:10:5">Item 2</li>
      <li data-loc="app/list.tsx:10:5">Item 3</li>
    `);

    const elements = scanDOMForSources(body);

    expect(elements).toHaveLength(3);
    expect(elements[0].id).toBe("loc:app/list.tsx:10:5#1");
    expect(elements[1].id).toBe("loc:app/list.tsx:10:5#2");
    expect(elements[2].id).toBe("loc:app/list.tsx:10:5#3");
  });
});

describe("cleanupDataAttributes", () => {
  let dom: JSDOM;
  let originalDocument: typeof globalThis.document;

  beforeEach(() => {
    originalDocument = globalThis.document;
  });

  afterEach(() => {
    globalThis.document = originalDocument;
    dom?.window.close();
  });

  it("resets runtime IDs to source location format", () => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
      <div data-loc="loc:app/page.tsx:10:5#1">Test</div>
    </body></html>`);
    globalThis.document = dom.window.document as unknown as Document;

    cleanupDataAttributes();

    const el = document.querySelector("[data-loc]");
    expect(el?.getAttribute("data-loc")).toBe("app/page.tsx:10:5");
  });

  it("does not modify non-runtime-ID data-loc values", () => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
      <div data-loc="app/page.tsx:10:5">Test</div>
    </body></html>`);
    globalThis.document = dom.window.document as unknown as Document;

    cleanupDataAttributes();

    const el = document.querySelector("[data-loc]");
    expect(el?.getAttribute("data-loc")).toBe("app/page.tsx:10:5");
  });
});

describe("getElementById", () => {
  let dom: JSDOM;
  let originalDocument: typeof globalThis.document;

  beforeEach(() => {
    originalDocument = globalThis.document;
  });

  afterEach(() => {
    globalThis.document = originalDocument;
    dom?.window.close();
  });

  it("finds element by UILint ID", () => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
      <div data-loc="loc:app/page.tsx:10:5#1">Found me</div>
      <div data-loc="loc:app/page.tsx:20:5#1">Other</div>
    </body></html>`);
    globalThis.document = dom.window.document as unknown as Document;

    const el = getElementById("loc:app/page.tsx:10:5#1");

    expect(el).not.toBeNull();
    expect(el?.textContent).toBe("Found me");
  });

  it("returns null for non-existent ID", () => {
    dom = new JSDOM(`<!DOCTYPE html><html><body>
      <div data-loc="loc:app/page.tsx:10:5#1">Test</div>
    </body></html>`);
    globalThis.document = dom.window.document as unknown as Document;

    const el = getElementById("non-existent-id");

    expect(el).toBeNull();
  });
});

describe("updateElementRects", () => {
  it("updates rect property for all elements", () => {
    const mockRect = {
      x: 100,
      y: 200,
      width: 150,
      height: 50,
      top: 200,
      left: 100,
      right: 250,
      bottom: 250,
    } as DOMRect;

    const mockElement = {
      getBoundingClientRect: vi.fn().mockReturnValue(mockRect),
    } as unknown as Element;

    const elements: ScannedElement[] = [
      {
        id: "1",
        element: mockElement,
        tagName: "div",
        className: "",
        source: { fileName: "app/page.tsx", lineNumber: 10 },
        rect: { x: 0, y: 0, width: 0, height: 0 } as DOMRect,
      },
    ];

    const updated = updateElementRects(elements);

    expect(updated[0].rect).toEqual(mockRect);
    expect(mockElement.getBoundingClientRect).toHaveBeenCalled();
  });

  it("preserves other element properties", () => {
    const mockElement = {
      getBoundingClientRect: vi.fn().mockReturnValue({ x: 0, y: 0, width: 0, height: 0 }),
    } as unknown as Element;

    const elements: ScannedElement[] = [
      {
        id: "test-id",
        element: mockElement,
        tagName: "button",
        className: "btn-primary",
        source: { fileName: "app/page.tsx", lineNumber: 10, columnNumber: 5 },
        rect: { x: 0, y: 0, width: 0, height: 0 } as DOMRect,
      },
    ];

    const updated = updateElementRects(elements);

    expect(updated[0].id).toBe("test-id");
    expect(updated[0].tagName).toBe("button");
    expect(updated[0].className).toBe("btn-primary");
    expect(updated[0].source.lineNumber).toBe(10);
  });
});
