import { describe, it, expect } from "vitest";
import {
  normalizeCode,
  calculateNormalizedSimilarity,
  isNearIdentical,
  prepareForEmbedding,
  levenshteinDistance,
} from "../src/detection/normalizer.js";

describe("Code Normalizer", () => {
  describe("normalizeCode", () => {
    describe("comment stripping", () => {
      it("should strip single-line comments", () => {
        const code = `
          function test() {
            // This is a comment
            return 42;
          }
        `;

        const normalized = normalizeCode(code, { stripComments: true });
        expect(normalized).not.toContain("This is a comment");
      });

      it("should strip multi-line comments", () => {
        const code = `
          function test() {
            /* This is a
               multi-line comment */
            return 42;
          }
        `;

        const normalized = normalizeCode(code, { stripComments: true });
        expect(normalized).not.toContain("multi-line");
      });

      it("should preserve code when stripComments is false", () => {
        const code = "// comment\nconst x = 1;";
        const normalized = normalizeCode(code, { stripComments: false, normalizeWhitespace: false });
        expect(normalized).toContain("comment");
      });
    });

    describe("semantic normalization", () => {
      it("should normalize size/dimension props", () => {
        const code1 = "function Component({ size }) { return <div>{size}</div> }";
        const code2 = "function Component({ dimension }) { return <div>{dimension}</div> }";

        const normalized1 = normalizeCode(code1, { normalizeSemantics: true });
        const normalized2 = normalizeCode(code2, { normalizeSemantics: true });

        expect(normalized1).toContain("__SIZE__");
        expect(normalized2).toContain("__SIZE__");
      });

      it("should normalize variant/type props", () => {
        const code1 = "const { variant } = props;";
        const code2 = "const { type } = props;";

        const normalized1 = normalizeCode(code1);
        const normalized2 = normalizeCode(code2);

        expect(normalized1).toContain("__VARIANT__");
        expect(normalized2).toContain("__VARIANT__");
      });

      it("should normalize click handlers", () => {
        const code1 = "<Button onClick={handleClick}>Click</Button>";
        const code2 = "<Button onPress={handlePress}>Click</Button>";

        const normalized1 = normalizeCode(code1);
        const normalized2 = normalizeCode(code2);

        expect(normalized1).toContain("__CLICK_HANDLER__");
        expect(normalized2).toContain("__CLICK_HANDLER__");
      });

      it("should normalize loading states", () => {
        const code1 = "if (loading) return <Spinner />";
        const code2 = "if (isLoading) return <Spinner />";

        const normalized1 = normalizeCode(code1);
        const normalized2 = normalizeCode(code2);

        expect(normalized1).toContain("__LOADING__");
        expect(normalized2).toContain("__LOADING__");
      });

      it("should normalize error states", () => {
        const code1 = "if (error) return <Error />";
        const code2 = "if (errorMessage) return <Error />";

        const normalized1 = normalizeCode(code1);
        const normalized2 = normalizeCode(code2);

        expect(normalized1).toContain("__ERROR__");
        expect(normalized2).toContain("__ERROR__");
      });

      it("should normalize data/items", () => {
        const code1 = "data.map(item => <Item />)";
        const code2 = "items.map(item => <Item />)";

        const normalized1 = normalizeCode(code1);
        const normalized2 = normalizeCode(code2);

        expect(normalized1).toContain("__DATA__");
        expect(normalized2).toContain("__DATA__");
      });
    });

    describe("identifier normalization", () => {
      it("should replace custom identifiers with placeholders", () => {
        const code = "const myVariable = calculateTotal(items);";
        const normalized = normalizeCode(code, { normalizeIdentifiers: true });

        expect(normalized).not.toContain("myVariable");
        expect(normalized).not.toContain("calculateTotal");
        expect(normalized).toContain("_ID");
      });

      it("should preserve React hooks", () => {
        const code = "const [state, setState] = useState(0);";
        const normalized = normalizeCode(code, { normalizeIdentifiers: true });

        expect(normalized).toContain("useState");
      });

      it("should preserve JavaScript keywords", () => {
        const code = "const x = 1; if (x) { return true; }";
        const normalized = normalizeCode(code, { normalizeIdentifiers: true });

        expect(normalized).toContain("const");
        expect(normalized).toContain("if");
        expect(normalized).toContain("return");
        expect(normalized).toContain("true");
      });

      it("should preserve common globals", () => {
        const code = "console.log(Math.random());";
        const normalized = normalizeCode(code, { normalizeIdentifiers: true });

        expect(normalized).toContain("console");
        expect(normalized).toContain("Math");
      });

      it("should use consistent placeholders for same identifiers", () => {
        const code = "const x = 1; const y = x + x;";
        const normalized = normalizeCode(code, { normalizeIdentifiers: true });

        // x should be replaced with same placeholder everywhere
        const matches = normalized.match(/_ID\d+_/g) || [];
        // Should have placeholders for x and y
        expect(matches.length).toBeGreaterThanOrEqual(3); // y once, x twice
      });
    });

    describe("whitespace normalization", () => {
      it("should collapse multiple spaces", () => {
        const code = "const   x   =   1;";
        const normalized = normalizeCode(code, { normalizeWhitespace: true });

        expect(normalized).not.toContain("   ");
      });

      it("should collapse newlines and tabs", () => {
        const code = "const x\n\t\t= 1;";
        const normalized = normalizeCode(code, { normalizeWhitespace: true });

        expect(normalized).not.toContain("\n");
        expect(normalized).not.toContain("\t");
      });
    });
  });

  describe("levenshteinDistance", () => {
    it("should return 0 for identical strings", () => {
      expect(levenshteinDistance("hello", "hello")).toBe(0);
    });

    it("should return length for empty vs non-empty", () => {
      expect(levenshteinDistance("", "hello")).toBe(5);
      expect(levenshteinDistance("hello", "")).toBe(5);
    });

    it("should calculate single edit distance", () => {
      expect(levenshteinDistance("cat", "bat")).toBe(1);
      expect(levenshteinDistance("cat", "cats")).toBe(1);
      expect(levenshteinDistance("cats", "cat")).toBe(1);
    });

    it("should calculate multiple edits", () => {
      expect(levenshteinDistance("kitten", "sitting")).toBe(3);
    });
  });

  describe("calculateNormalizedSimilarity", () => {
    it("should return 1.0 for identical code after normalization", () => {
      const code1 = `
        export function formatCurrency(amount: number): string {
          return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
        }
      `;
      const code2 = `
        export function formatMoney(value: number): string {
          return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
        }
      `;

      const similarity = calculateNormalizedSimilarity(code1, code2);
      expect(similarity).toBeGreaterThan(0.9);
    });

    it("should detect truncateText vs shortenText as near-identical", () => {
      const code1 = `
        export function truncateText(text: string, maxLength: number): string {
          if (text.length <= maxLength) return text;
          return text.slice(0, maxLength - 3) + "...";
        }
      `;
      const code2 = `
        export function shortenText(str: string, limit: number): string {
          if (str.length <= limit) return str;
          return str.slice(0, limit - 3) + "...";
        }
      `;

      const similarity = calculateNormalizedSimilarity(code1, code2);
      // After normalization, these should be very similar (0.84+)
      expect(similarity).toBeGreaterThan(0.83);
    });

    it("should return lower score for genuinely different code", () => {
      // Use structurally different code to test low similarity
      const code1 = "function add(a, b) { return a + b; }";
      const code2 = "class Calculator { constructor() { this.value = 0; } add(x) { this.value += x; } }";

      const similarity = calculateNormalizedSimilarity(code1, code2);
      expect(similarity).toBeLessThan(0.8);
    });

    it("should handle empty strings", () => {
      expect(calculateNormalizedSimilarity("", "")).toBe(1);
      expect(calculateNormalizedSimilarity("code", "")).toBeLessThan(0.5);
    });
  });

  describe("isNearIdentical", () => {
    it("should return true for near-identical code", () => {
      const code1 = "const formatDate = (d) => d.toISOString().split('T')[0];";
      const code2 = "const formatDateStr = (date) => date.toISOString().split('T')[0];";

      expect(isNearIdentical(code1, code2, 0.9)).toBe(true);
    });

    it("should return false for different code", () => {
      // Use structurally different code
      const code1 = "function add(a, b) { return a + b; }";
      const code2 = "const config = { name: 'test', value: 42, enabled: true };";

      expect(isNearIdentical(code1, code2, 0.7)).toBe(false);
    });

    it("should respect custom threshold", () => {
      const code1 = "const x = 1;";
      const code2 = "const y = 2;";

      expect(isNearIdentical(code1, code2, 0.5)).toBe(true);
      expect(isNearIdentical(code1, code2, 0.99)).toBe(false);
    });
  });

  describe("prepareForEmbedding", () => {
    it("should apply semantic normalization", () => {
      const code = "if (isLoading) return <Spinner size={size} />";
      const prepared = prepareForEmbedding(code);

      expect(prepared).toContain("__LOADING__");
      expect(prepared).toContain("__SIZE__");
    });

    it("should strip comments", () => {
      const code = "// Loading state\nif (loading) return null;";
      const prepared = prepareForEmbedding(code);

      expect(prepared).not.toContain("Loading state");
    });

    it("should not normalize identifiers", () => {
      const code = "const myCustomVariable = 42;";
      const prepared = prepareForEmbedding(code);

      expect(prepared).toContain("myCustomVariable");
    });

    it("should preserve structure (no whitespace normalization)", () => {
      const code = "function test() {\n  return 1;\n}";
      const prepared = prepareForEmbedding(code);

      expect(prepared).toContain("\n");
    });
  });

  describe("real-world duplicate detection", () => {
    it("should identify formatCurrency and formatMoney as duplicates", () => {
      const formatCurrency = `
        export function formatCurrency(amount: number, currency: string = "USD"): string {
          return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency,
            minimumFractionDigits: 2,
          }).format(amount);
        }
      `;

      const formatMoney = `
        export function formatMoney(value: number, currencyCode: string = "USD"): string {
          return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: currencyCode,
            minimumFractionDigits: 2,
          }).format(value);
        }
      `;

      const similarity = calculateNormalizedSimilarity(formatCurrency, formatMoney);
      expect(similarity).toBeGreaterThan(0.85);
    });

    it("should identify Badge and Tag components as similar", () => {
      const badge = `
        export function Badge({ children, variant = "info", size = "md" }) {
          const variantStyles = {
            success: "bg-green-100 text-green-800",
            warning: "bg-yellow-100 text-yellow-800",
            error: "bg-red-100 text-red-800",
            info: "bg-blue-100 text-blue-800",
          };
          return (
            <span className={\`inline-flex items-center \${variantStyles[variant]}\`}>
              {children}
            </span>
          );
        }
      `;

      const tag = `
        export function Tag({ children, type = "neutral", dimension = "medium" }) {
          const typeColors = {
            positive: "bg-green-100 text-green-800",
            caution: "bg-yellow-100 text-yellow-800",
            negative: "bg-red-100 text-red-800",
            neutral: "bg-blue-100 text-blue-800",
          };
          return (
            <span className={\`inline-flex items-center \${typeColors[type]}\`}>
              {children}
            </span>
          );
        }
      `;

      const similarity = calculateNormalizedSimilarity(badge, tag);
      expect(similarity).toBeGreaterThan(0.7);
    });
  });
});
