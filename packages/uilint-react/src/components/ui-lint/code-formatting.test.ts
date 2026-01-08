import { describe, expect, it } from "vitest";
import { dedentLines } from "./code-formatting";

describe("dedentLines", () => {
  it("returns empty unchanged", () => {
    expect(dedentLines([])).toEqual({ lines: [], removed: 0 });
  });

  it("returns whitespace-only unchanged", () => {
    expect(dedentLines(["   ", "\t", ""])).toEqual({
      lines: ["   ", "\t", ""],
      removed: 0,
    });
  });

  it("removes the minimum indent across non-empty lines", () => {
    const input = [
      "    const a = 1;",
      "      const b = 2;",
      "",
      "    return a;",
    ];
    const out = dedentLines(input);
    expect(out.removed).toBe(4);
    expect(out.lines).toEqual([
      "const a = 1;",
      "  const b = 2;",
      "",
      "return a;",
    ]);
  });

  it("ignores empty lines when computing indentation", () => {
    const input = ["", "    foo()", "    bar()", ""];
    const out = dedentLines(input);
    expect(out.removed).toBe(4);
    expect(out.lines).toEqual(["", "foo()", "bar()", ""]);
  });

  it("does not dedent when one non-empty line has no indent", () => {
    const input = ["  indented()", "notIndented()"];
    const out = dedentLines(input);
    expect(out.removed).toBe(0);
    expect(out.lines).toEqual(input);
  });

  it("dedents tabs by character count (best-effort)", () => {
    const input = ["\t\tfoo()", "\t\tbar()", "\t\tbaz()"];
    const out = dedentLines(input);
    expect(out.removed).toBe(2);
    expect(out.lines).toEqual(["foo()", "bar()", "baz()"]);
  });
});
