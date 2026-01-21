/**
 * Tests for: import-graph utilities
 *
 * Tests the cross-file import resolution and library detection.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync, realpathSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { getComponentLibrary, clearCache } from "../rules/no-mixed-component-libraries/lib/import-graph";
import { detectLibraryFromSource, LIBRARY_PATTERNS } from "../rules/no-mixed-component-libraries/lib/component-parser";
import {
  resolveImportPath,
  resolveExport,
  clearResolverCaches,
} from "../rules/no-mixed-component-libraries/lib/export-resolver";

describe("detectLibraryFromSource", () => {
  it("detects MUI from @mui/material", () => {
    expect(detectLibraryFromSource("@mui/material")).toBe("mui");
  });

  it("detects MUI from @mui/icons-material", () => {
    expect(detectLibraryFromSource("@mui/icons-material")).toBe("mui");
  });

  it("detects shadcn from @/components/ui path", () => {
    expect(detectLibraryFromSource("@/components/ui/button")).toBe("shadcn");
  });

  it("detects shadcn from relative components/ui path", () => {
    expect(detectLibraryFromSource("./components/ui/button")).toBe("shadcn");
  });

  it("detects shadcn from @radix-ui", () => {
    expect(detectLibraryFromSource("@radix-ui/react-dialog")).toBe("shadcn");
  });

  it("detects chakra from @chakra-ui", () => {
    expect(detectLibraryFromSource("@chakra-ui/react")).toBe("chakra");
  });

  it("detects antd from antd package", () => {
    expect(detectLibraryFromSource("antd")).toBe("antd");
  });

  it("detects antd from @ant-design", () => {
    expect(detectLibraryFromSource("@ant-design/icons")).toBe("antd");
  });

  it("returns null for unknown libraries", () => {
    expect(detectLibraryFromSource("./my-custom-component")).toBeNull();
  });

  it("returns null for react", () => {
    expect(detectLibraryFromSource("react")).toBeNull();
  });

  it("returns null for next", () => {
    expect(detectLibraryFromSource("next/link")).toBeNull();
  });
});

describe("getComponentLibrary - direct imports", () => {
  beforeEach(() => {
    clearCache();
  });

  it("identifies MUI component from direct import", () => {
    const result = getComponentLibrary(
      "/project/page.tsx",
      "Button",
      "@mui/material"
    );

    expect(result.library).toBe("mui");
    expect(result.isLocalComponent).toBe(false);
    expect(result.internalLibraries.size).toBe(0);
  });

  it("identifies Chakra component from direct import", () => {
    const result = getComponentLibrary(
      "/project/page.tsx",
      "Box",
      "@chakra-ui/react"
    );

    expect(result.library).toBe("chakra");
    expect(result.isLocalComponent).toBe(false);
  });

  it("identifies Ant Design component from direct import", () => {
    const result = getComponentLibrary("/project/page.tsx", "Button", "antd");

    expect(result.library).toBe("antd");
    expect(result.isLocalComponent).toBe(false);
  });

  it("identifies shadcn component from @/components/ui import", () => {
    const result = getComponentLibrary(
      "/project/page.tsx",
      "Button",
      "@/components/ui/button"
    );

    expect(result.library).toBe("shadcn");
    expect(result.isLocalComponent).toBe(false);
  });

  it("returns null library for unknown external imports", () => {
    const result = getComponentLibrary(
      "/project/page.tsx",
      "SomeComponent",
      "some-unknown-package"
    );

    expect(result.library).toBeNull();
    expect(result.isLocalComponent).toBe(false);
  });
});

describe("cross-file analysis with temp files", () => {
  let testDir: string;

  beforeEach(() => {
    clearCache();
    clearResolverCaches();

    // Create a temporary test directory
    testDir = join(tmpdir(), `uilint-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("detects MUI usage in local component", () => {
    // Create a local component that uses MUI
    const cardPath = join(testDir, "MyCard.tsx");
    writeFileSync(
      cardPath,
      `
import { Card, CardContent } from "@mui/material";

export function MyCard() {
  return (
    <Card>
      <CardContent>Hello</CardContent>
    </Card>
  );
}
`
    );

    // Create tsconfig.json for path resolution
    writeFileSync(
      join(testDir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          baseUrl: ".",
          paths: { "@/*": ["./*"] },
        },
      })
    );

    const pagePath = join(testDir, "page.tsx");

    const result = getComponentLibrary(pagePath, "MyCard", "./MyCard");

    expect(result.isLocalComponent).toBe(true);
    expect(result.internalLibraries.has("mui")).toBe(true);
    expect(result.libraryEvidence.some((e) => e.library === "mui")).toBe(true);
  });

  it("follows re-exports through barrel files", () => {
    // Create the actual component
    const buttonPath = join(testDir, "components", "Button.tsx");
    mkdirSync(join(testDir, "components"), { recursive: true });

    writeFileSync(
      buttonPath,
      `
import { Button as MuiButton } from "@mui/material";

export function Button() {
  return <MuiButton>Click me</MuiButton>;
}
`
    );

    // Create barrel file
    writeFileSync(
      join(testDir, "components", "index.ts"),
      `export { Button } from "./Button";`
    );

    const pagePath = join(testDir, "page.tsx");

    const result = getComponentLibrary(pagePath, "Button", "./components");

    expect(result.isLocalComponent).toBe(true);
    expect(result.internalLibraries.has("mui")).toBe(true);
  });

  it("handles components with no library usage", () => {
    const componentPath = join(testDir, "PureComponent.tsx");
    writeFileSync(
      componentPath,
      `
export function PureComponent() {
  return <div className="p-4">Pure HTML</div>;
}
`
    );

    const pagePath = join(testDir, "page.tsx");

    const result = getComponentLibrary(
      pagePath,
      "PureComponent",
      "./PureComponent"
    );

    expect(result.isLocalComponent).toBe(true);
    expect(result.library).toBeNull();
    expect(result.internalLibraries.size).toBe(0);
  });

  it("detects nested library usage (component uses component that uses library)", () => {
    // Create nested structure
    mkdirSync(join(testDir, "components"), { recursive: true });

    // Inner component uses MUI
    writeFileSync(
      join(testDir, "components", "InnerCard.tsx"),
      `
import { Card } from "@mui/material";
export function InnerCard({ children }) {
  return <Card>{children}</Card>;
}
`
    );

    // Outer component uses inner component
    writeFileSync(
      join(testDir, "components", "OuterCard.tsx"),
      `
import { InnerCard } from "./InnerCard";
export function OuterCard({ title }) {
  return <InnerCard>{title}</InnerCard>;
}
`
    );

    const pagePath = join(testDir, "page.tsx");

    const result = getComponentLibrary(
      pagePath,
      "OuterCard",
      "./components/OuterCard"
    );

    expect(result.isLocalComponent).toBe(true);
    expect(result.internalLibraries.has("mui")).toBe(true);
    // Should show evidence chain
    expect(result.libraryEvidence.length).toBeGreaterThan(0);
  });

  it("handles circular dependencies gracefully", () => {
    mkdirSync(join(testDir, "components"), { recursive: true });

    // Component A imports B
    writeFileSync(
      join(testDir, "components", "ComponentA.tsx"),
      `
import { ComponentB } from "./ComponentB";
export function ComponentA() {
  return <ComponentB />;
}
`
    );

    // Component B imports A (circular)
    writeFileSync(
      join(testDir, "components", "ComponentB.tsx"),
      `
import { ComponentA } from "./ComponentA";
export function ComponentB() {
  return <div>B</div>;
}
`
    );

    const pagePath = join(testDir, "page.tsx");

    // Should not hang or throw
    const result = getComponentLibrary(
      pagePath,
      "ComponentA",
      "./components/ComponentA"
    );

    expect(result.isLocalComponent).toBe(true);
    // Should complete without error
  });
});

describe("resolveImportPath", () => {
  let testDir: string;

  beforeEach(() => {
    clearResolverCaches();
    testDir = join(tmpdir(), `uilint-resolve-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("resolves relative imports", () => {
    writeFileSync(
      join(testDir, "button.tsx"),
      "export const Button = () => {};"
    );

    const result = resolveImportPath("./button", join(testDir, "page.tsx"));

    // Use realpathSync to normalize paths (handles /var vs /private/var on macOS)
    expect(result).toBe(realpathSync(join(testDir, "button.tsx")));
  });

  it("resolves index files", () => {
    mkdirSync(join(testDir, "components"), { recursive: true });
    writeFileSync(
      join(testDir, "components", "index.ts"),
      "export const X = 1;"
    );

    const result = resolveImportPath("./components", join(testDir, "page.tsx"));

    // Use realpathSync to normalize paths (handles /var vs /private/var on macOS)
    expect(result).toBe(realpathSync(join(testDir, "components", "index.ts")));
  });

  it("returns null for node_modules packages", () => {
    const result = resolveImportPath("react", join(testDir, "page.tsx"));
    expect(result).toBeNull();
  });

  it("returns null for @mui packages", () => {
    const result = resolveImportPath(
      "@mui/material",
      join(testDir, "page.tsx")
    );
    expect(result).toBeNull();
  });
});

describe("resolveExport", () => {
  let testDir: string;

  beforeEach(() => {
    clearResolverCaches();
    testDir = join(tmpdir(), `uilint-export-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("resolves direct named export", () => {
    const filePath = join(testDir, "button.tsx");
    writeFileSync(filePath, "export function Button() { return <button />; }");

    const result = resolveExport("Button", filePath);

    expect(result).not.toBeNull();
    expect(result!.name).toBe("Button");
    expect(result!.filePath).toBe(filePath);
    expect(result!.isReexport).toBe(false);
  });

  it("follows re-exports", () => {
    const buttonPath = join(testDir, "button.tsx");
    writeFileSync(
      buttonPath,
      "export function Button() { return <button />; }"
    );

    const indexPath = join(testDir, "index.ts");
    writeFileSync(indexPath, `export { Button } from "./button";`);

    const result = resolveExport("Button", indexPath);

    expect(result).not.toBeNull();
    expect(result!.name).toBe("Button");
    // Use realpathSync to normalize paths (handles /var vs /private/var on macOS)
    expect(result!.filePath).toBe(realpathSync(buttonPath));
  });

  it("returns null for non-existent export", () => {
    const filePath = join(testDir, "button.tsx");
    writeFileSync(filePath, "export function Button() {}");

    const result = resolveExport("NonExistent", filePath);

    expect(result).toBeNull();
  });
});
