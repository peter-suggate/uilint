/**
 * Tests for DuplicateSimilarityBadge component
 * @vitest-environment jsdom
 *
 * Tests the color-coded similarity badge display.
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import {
  DuplicateSimilarityBadge,
  getSimilarityColor,
  getSimilarityLabel,
} from "./DuplicateSimilarityBadge";

// Clean up after each test to avoid element accumulation
afterEach(() => {
  cleanup();
});

// ============================================================================
// getSimilarityColor Tests
// ============================================================================

describe("getSimilarityColor", () => {
  describe("high similarity (85%+)", () => {
    it("returns red colors for 85%", () => {
      const colors = getSimilarityColor(85);
      expect(colors.bg).toBe("rgba(239, 68, 68, 0.15)");
      expect(colors.border).toBe("rgba(239, 68, 68, 0.3)");
      expect(colors.text).toBe("#dc2626");
    });

    it("returns red colors for 90%", () => {
      const colors = getSimilarityColor(90);
      expect(colors.text).toBe("#dc2626");
    });

    it("returns red colors for 100%", () => {
      const colors = getSimilarityColor(100);
      expect(colors.text).toBe("#dc2626");
    });
  });

  describe("medium similarity (70-84%)", () => {
    it("returns orange colors for 70%", () => {
      const colors = getSimilarityColor(70);
      expect(colors.bg).toBe("rgba(245, 158, 11, 0.15)");
      expect(colors.border).toBe("rgba(245, 158, 11, 0.3)");
      expect(colors.text).toBe("#d97706");
    });

    it("returns orange colors for 84%", () => {
      const colors = getSimilarityColor(84);
      expect(colors.text).toBe("#d97706");
    });

    it("returns orange colors for 75%", () => {
      const colors = getSimilarityColor(75);
      expect(colors.text).toBe("#d97706");
    });
  });

  describe("low similarity (<70%)", () => {
    it("returns yellow colors for 69%", () => {
      const colors = getSimilarityColor(69);
      expect(colors.bg).toBe("rgba(234, 179, 8, 0.15)");
      expect(colors.border).toBe("rgba(234, 179, 8, 0.3)");
      expect(colors.text).toBe("#ca8a04");
    });

    it("returns yellow colors for 50%", () => {
      const colors = getSimilarityColor(50);
      expect(colors.text).toBe("#ca8a04");
    });

    it("returns yellow colors for 0%", () => {
      const colors = getSimilarityColor(0);
      expect(colors.text).toBe("#ca8a04");
    });
  });
});

// ============================================================================
// getSimilarityLabel Tests
// ============================================================================

describe("getSimilarityLabel", () => {
  it("returns 'Very High' for 85%+", () => {
    expect(getSimilarityLabel(85)).toBe("Very High");
    expect(getSimilarityLabel(90)).toBe("Very High");
    expect(getSimilarityLabel(100)).toBe("Very High");
  });

  it("returns 'High' for 70-84%", () => {
    expect(getSimilarityLabel(70)).toBe("High");
    expect(getSimilarityLabel(75)).toBe("High");
    expect(getSimilarityLabel(84)).toBe("High");
  });

  it("returns 'Moderate' for <70%", () => {
    expect(getSimilarityLabel(69)).toBe("Moderate");
    expect(getSimilarityLabel(50)).toBe("Moderate");
    expect(getSimilarityLabel(0)).toBe("Moderate");
  });
});

// ============================================================================
// DuplicateSimilarityBadge Component Tests
// ============================================================================

describe("DuplicateSimilarityBadge", () => {
  describe("percentage display", () => {
    it("displays percentage from decimal value (0-1)", () => {
      render(<DuplicateSimilarityBadge similarity={0.85} />);

      expect(screen.getByText("85%")).toBeDefined();
    });

    it("displays percentage from whole number (0-100)", () => {
      render(<DuplicateSimilarityBadge similarity={85} />);

      expect(screen.getByText("85%")).toBeDefined();
    });

    it("rounds decimal percentages", () => {
      render(<DuplicateSimilarityBadge similarity={0.856} />);

      expect(screen.getByText("86%")).toBeDefined();
    });
  });

  describe("label display", () => {
    it("displays 'Very High' label for high similarity", () => {
      render(<DuplicateSimilarityBadge similarity={0.9} />);

      expect(screen.getByText("Very High")).toBeDefined();
    });

    it("displays 'High' label for medium similarity", () => {
      render(<DuplicateSimilarityBadge similarity={0.75} />);

      expect(screen.getByText("High")).toBeDefined();
    });

    it("displays 'Moderate' label for low similarity", () => {
      render(<DuplicateSimilarityBadge similarity={0.5} />);

      expect(screen.getByText("Moderate")).toBeDefined();
    });
  });

  describe("styling", () => {
    it("applies custom className when provided", () => {
      const { container } = render(
        <DuplicateSimilarityBadge similarity={0.85} className="custom-class" />
      );

      expect(container.firstChild).not.toBeNull();
      expect((container.firstChild as Element)?.classList.contains("custom-class")).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles 0% similarity", () => {
      render(<DuplicateSimilarityBadge similarity={0} />);

      expect(screen.getByText("0%")).toBeDefined();
      expect(screen.getByText("Moderate")).toBeDefined();
    });

    it("handles 100% similarity", () => {
      render(<DuplicateSimilarityBadge similarity={1} />);

      expect(screen.getByText("100%")).toBeDefined();
      expect(screen.getByText("Very High")).toBeDefined();
    });

    it("handles boundary value 0.7 (70%)", () => {
      render(<DuplicateSimilarityBadge similarity={0.7} />);

      expect(screen.getByText("70%")).toBeDefined();
      expect(screen.getByText("High")).toBeDefined();
    });

    it("handles boundary value 0.85 (85%)", () => {
      render(<DuplicateSimilarityBadge similarity={0.85} />);

      expect(screen.getByText("85%")).toBeDefined();
      expect(screen.getByText("Very High")).toBeDefined();
    });
  });
});
