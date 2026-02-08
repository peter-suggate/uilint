import { describe, it, expect } from "vitest";
import { parseHTML, parseCLIInput, isJSON } from "../../src/scanner/html-parser.js";

describe("isJSON", () => {
  it("returns true for strings starting with {", () => {
    expect(isJSON('{"key": "value"}')).toBe(true);
  });

  it("returns true for strings starting with [", () => {
    expect(isJSON('[1, 2, 3]')).toBe(true);
  });

  it("returns true with leading whitespace", () => {
    expect(isJSON('  {"key": "value"}')).toBe(true);
    expect(isJSON("  [1]")).toBe(true);
  });

  it("returns false for HTML strings", () => {
    expect(isJSON("<div>hello</div>")).toBe(false);
  });

  it("returns false for plain text", () => {
    expect(isJSON("hello world")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isJSON("")).toBe(false);
  });
});

describe("parseHTML", () => {
  it("parses simple HTML and returns a DOMSnapshot", () => {
    const html = "<div><p>Hello</p><span>World</span></div>";
    const result = parseHTML(html);

    expect(result.html).toContain("<div>");
    expect(result.elementCount).toBeGreaterThanOrEqual(3); // div, p, span
    expect(result.timestamp).toBeGreaterThan(0);
    expect(result.styles).toBeDefined();
  });

  it("returns extracted style maps with correct structure", () => {
    const html = '<div style="color: red; font-size: 16px;">Hello</div>';
    const result = parseHTML(html);

    expect(result.styles.colors).toBeInstanceOf(Map);
    expect(result.styles.fontSizes).toBeInstanceOf(Map);
    expect(result.styles.fontFamilies).toBeInstanceOf(Map);
    expect(result.styles.fontWeights).toBeInstanceOf(Map);
    expect(result.styles.spacing).toBeInstanceOf(Map);
    expect(result.styles.borderRadius).toBeInstanceOf(Map);
  });

  it("truncates HTML when exceeding maxHtmlLength", () => {
    const longHtml = "<div>" + "x".repeat(100000) + "</div>";
    const result = parseHTML(longHtml, { maxHtmlLength: 100 });

    expect(result.html.length).toBeLessThanOrEqual(150); // some tolerance for truncation marker
  });

  it("counts all descendant elements", () => {
    const html = `
      <div>
        <header><nav><a href="#">Link</a></nav></header>
        <main><p>Text</p></main>
        <footer><span>Footer</span></footer>
      </div>
    `;
    const result = parseHTML(html);

    // div, header, nav, a, main, p, footer, span = 8
    expect(result.elementCount).toBeGreaterThanOrEqual(8);
  });

  it("handles empty HTML", () => {
    const result = parseHTML("");
    expect(result.elementCount).toBeGreaterThanOrEqual(0);
    expect(result.timestamp).toBeGreaterThan(0);
  });
});

describe("parseCLIInput", () => {
  it("parses raw HTML when input is not JSON", () => {
    const html = "<div><p>Hello</p></div>";
    const result = parseCLIInput(html);

    expect(result.html).toContain("<div>");
    expect(result.styles).toBeDefined();
  });

  it("parses JSON with html field only as HTML", () => {
    const input = JSON.stringify({ html: "<div>Test</div>" });
    const result = parseCLIInput(input);

    expect(result.html).toContain("<div>");
    expect(result.styles).toBeDefined();
  });

  it("uses pre-extracted styles when JSON has both html and styles", () => {
    const input = JSON.stringify({
      html: "<div>Test</div>",
      styles: {
        colors: { red: 1 },
        fontSizes: { "16px": 2 },
        fontFamilies: {},
        fontWeights: {},
        spacing: {},
        borderRadius: {},
      },
    });
    const result = parseCLIInput(input);

    expect(result.html).toContain("<div>");
    expect(result.styles.colors.get("red")).toBe(1);
    expect(result.styles.fontSizes.get("16px")).toBe(2);
    expect(result.elementCount).toBe(0); // not available for pre-extracted
  });

  it("falls back to raw HTML parsing for invalid JSON", () => {
    const result = parseCLIInput("not json { invalid");

    expect(result.styles).toBeDefined();
    expect(result.timestamp).toBeGreaterThan(0);
  });
});
