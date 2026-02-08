import { describe, it, expect } from "vitest";
import {
  buildAnalysisPrompt,
  buildSourceAnalysisPrompt,
  buildSourceScanPrompt,
  buildStyleGuidePrompt,
} from "../../src/ollama/prompts.js";

describe("buildAnalysisPrompt", () => {
  it("includes style guide when provided", () => {
    const result = buildAnalysisPrompt("styles here", "## Colors\n- Red");

    expect(result).toContain("## Current Style Guide");
    expect(result).toContain("## Colors\n- Red");
  });

  it("includes fallback when no style guide", () => {
    const result = buildAnalysisPrompt("styles here", null);

    expect(result).toContain("## No Style Guide Found");
    expect(result).toContain("identify inconsistencies");
  });

  it("includes the style summary", () => {
    const result = buildAnalysisPrompt("font-size: 16px used 5 times", null);

    expect(result).toContain("font-size: 16px used 5 times");
  });

  it("requests JSON-only response", () => {
    const result = buildAnalysisPrompt("styles", null);

    expect(result).toContain("Respond with JSON ONLY");
    expect(result).toContain('"issues"');
  });
});

describe("buildSourceAnalysisPrompt", () => {
  it("includes style guide section when provided", () => {
    const result = buildSourceAnalysisPrompt(
      "const App = () => <div/>",
      "## Typography\n- h1: 2rem"
    );

    expect(result).toContain("## Current Style Guide");
    expect(result).toContain("## Typography");
  });

  it("includes fallback when no style guide", () => {
    const result = buildSourceAnalysisPrompt("<div/>", null);

    expect(result).toContain("## No Style Guide Found");
  });

  it("includes source code in the prompt", () => {
    const source = 'export function App() { return <div className="p-4">Hi</div>; }';
    const result = buildSourceAnalysisPrompt(source, null);

    expect(result).toContain(source);
  });

  it("includes file path metadata when provided", () => {
    const result = buildSourceAnalysisPrompt("<div/>", null, {
      filePath: "src/App.tsx",
    });

    expect(result).toContain("## Source Metadata");
    expect(result).toContain("filePath: src/App.tsx");
  });

  it("includes language hint metadata when provided", () => {
    const result = buildSourceAnalysisPrompt("<div/>", null, {
      languageHint: "tsx",
    });

    expect(result).toContain("languageHint: tsx");
  });

  it("includes extra context when provided", () => {
    const result = buildSourceAnalysisPrompt("<div/>", null, {
      extraContext: "Uses Tailwind v4 with custom theme.",
    });

    expect(result).toContain("## Additional Context");
    expect(result).toContain("Uses Tailwind v4 with custom theme.");
  });

  it("omits metadata section when no options provided", () => {
    const result = buildSourceAnalysisPrompt("<div/>", null);

    expect(result).not.toContain("## Source Metadata");
    expect(result).not.toContain("## Additional Context");
  });

  it("omits extra context when it is empty/whitespace", () => {
    const result = buildSourceAnalysisPrompt("<div/>", null, {
      extraContext: "   ",
    });

    expect(result).not.toContain("## Additional Context");
  });
});

describe("buildSourceScanPrompt", () => {
  it("includes source code in code fence", () => {
    const source = 'const x = <button className="bg-red-500">Click</button>';
    const result = buildSourceScanPrompt(source, null);

    expect(result).toContain("```tsx\n" + source + "\n```");
  });

  it("uses filePath as code fence label", () => {
    const result = buildSourceScanPrompt("code", null, {
      filePath: "src/Button.tsx",
    });

    expect(result).toContain("## Source Code (src/Button.tsx)");
  });

  it("defaults filePath to component.tsx", () => {
    const result = buildSourceScanPrompt("code", null);

    expect(result).toContain("## Source Code (component.tsx)");
  });

  it("includes style guide section when provided", () => {
    const result = buildSourceScanPrompt("code", "## Colors\n- Blue: #3B82F6");

    expect(result).toContain("## Style Guide");
    expect(result).toContain("## Colors");
  });

  it("omits style guide section when null", () => {
    const result = buildSourceScanPrompt("code", null);

    expect(result).not.toContain("## Style Guide");
  });

  it("includes focus section with component name", () => {
    const result = buildSourceScanPrompt("code", null, {
      componentName: "PrimaryButton",
    });

    expect(result).toContain("## Focus");
    expect(result).toContain('"PrimaryButton"');
  });

  it("includes line number in focus section", () => {
    const result = buildSourceScanPrompt("code", null, {
      componentName: "Card",
      componentLine: 42,
    });

    expect(result).toContain("(near line 42)");
  });

  it("omits focus section when no component name", () => {
    const result = buildSourceScanPrompt("code", null);

    expect(result).not.toContain("## Focus");
  });

  it("includes scope text for children", () => {
    const result = buildSourceScanPrompt("code", null, {
      includeChildren: true,
    });

    expect(result).toContain("Scope: selected element + children.");
  });

  it("defaults scope to element only", () => {
    const result = buildSourceScanPrompt("code", null);

    expect(result).toContain("Scope: selected element only.");
  });

  it("includes data-loc values when provided", () => {
    const result = buildSourceScanPrompt("code", null, {
      dataLocs: ["src/App.tsx:12:5", "src/App.tsx:18:3"],
    });

    expect(result).toContain("## Element Locations (data-loc values)");
    expect(result).toContain("src/App.tsx:12:5");
    expect(result).toContain("src/App.tsx:18:3");
  });

  it("omits data-loc section when array is empty", () => {
    const result = buildSourceScanPrompt("code", null, { dataLocs: [] });

    expect(result).not.toContain("## Element Locations");
  });
});

describe("buildStyleGuidePrompt", () => {
  it("includes the style summary", () => {
    const summary = "Colors: #3B82F6 (5 times), #10B981 (3 times)";
    const result = buildStyleGuidePrompt(summary);

    expect(result).toContain(summary);
  });

  it("requests markdown output format", () => {
    const result = buildStyleGuidePrompt("summary");

    expect(result).toContain("# UI Style Guide");
    expect(result).toContain("## Colors");
    expect(result).toContain("## Typography");
    expect(result).toContain("## Spacing");
  });
});
