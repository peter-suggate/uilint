/**
 * Tests for RegionSelector component
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { RegionSelector } from "./RegionSelector";

// Mock createPortal to render inline for testing
vi.mock("react-dom", async () => {
  const actual = await vi.importActual("react-dom");
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  };
});

describe("RegionSelector", () => {
  const defaultProps = {
    active: true,
    onRegionSelected: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Rendering", () => {
    it("does not render when active is false", () => {
      render(<RegionSelector {...defaultProps} active={false} />);

      // Should not find the overlay
      expect(screen.queryByTestId("region-selector-overlay")).toBeNull();
    });

    it("renders overlay when active is true", () => {
      render(<RegionSelector {...defaultProps} active={true} />);

      // Should find the overlay
      const overlay = screen.getByTestId("region-selector-overlay");
      expect(overlay).toBeDefined();
    });

    it("renders with crosshair cursor", () => {
      render(<RegionSelector {...defaultProps} active={true} />);

      const overlay = screen.getByTestId("region-selector-overlay");
      expect(overlay.style.cursor).toBe("crosshair");
    });

    it("renders with semi-transparent dark background", () => {
      render(<RegionSelector {...defaultProps} active={true} />);

      const overlay = screen.getByTestId("region-selector-overlay");
      expect(overlay.style.backgroundColor).toBe("rgba(0, 0, 0, 0.5)");
    });
  });

  describe("Selection Rectangle", () => {
    it("shows selection rectangle while dragging", () => {
      render(<RegionSelector {...defaultProps} active={true} />);

      const overlay = screen.getByTestId("region-selector-overlay");

      // Start dragging
      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100, button: 0 });

      // Move mouse
      fireEvent.mouseMove(overlay, { clientX: 200, clientY: 150 });

      // Selection rectangle should now be visible
      const selectionRect = screen.getByTestId("selection-rectangle");
      expect(selectionRect).toBeDefined();
    });

    it("displays dimensions while dragging", () => {
      render(<RegionSelector {...defaultProps} active={true} />);

      const overlay = screen.getByTestId("region-selector-overlay");

      // Start dragging
      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100, button: 0 });

      // Move mouse to create a 100x50 selection
      fireEvent.mouseMove(overlay, { clientX: 200, clientY: 150 });

      // Should show dimensions "100 x 50"
      const dimensionsLabel = screen.getByTestId("dimensions-label");
      expect(dimensionsLabel).toBeDefined();
      expect(dimensionsLabel.textContent).toContain("100");
      expect(dimensionsLabel.textContent).toContain("50");
    });

    it("calculates correct rectangle when dragging from top-left to bottom-right", () => {
      render(<RegionSelector {...defaultProps} active={true} />);

      const overlay = screen.getByTestId("region-selector-overlay");

      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100, button: 0 });
      fireEvent.mouseMove(overlay, { clientX: 200, clientY: 200 });

      const selectionRect = screen.getByTestId("selection-rectangle");
      expect(selectionRect.style.left).toBe("100px");
      expect(selectionRect.style.top).toBe("100px");
      expect(selectionRect.style.width).toBe("100px");
      expect(selectionRect.style.height).toBe("100px");
    });

    it("calculates correct rectangle when dragging from bottom-right to top-left", () => {
      render(<RegionSelector {...defaultProps} active={true} />);

      const overlay = screen.getByTestId("region-selector-overlay");

      // Start at bottom-right, drag to top-left
      fireEvent.mouseDown(overlay, { clientX: 200, clientY: 200, button: 0 });
      fireEvent.mouseMove(overlay, { clientX: 100, clientY: 100 });

      const selectionRect = screen.getByTestId("selection-rectangle");
      expect(selectionRect.style.left).toBe("100px");
      expect(selectionRect.style.top).toBe("100px");
      expect(selectionRect.style.width).toBe("100px");
      expect(selectionRect.style.height).toBe("100px");
    });
  });

  describe("Selection Completion", () => {
    it("calls onRegionSelected with correct coordinates on valid selection", () => {
      const onRegionSelected = vi.fn();
      render(
        <RegionSelector
          {...defaultProps}
          onRegionSelected={onRegionSelected}
        />
      );

      const overlay = screen.getByTestId("region-selector-overlay");

      // Create a valid selection (larger than 10x10)
      fireEvent.mouseDown(overlay, { clientX: 50, clientY: 50, button: 0 });
      fireEvent.mouseMove(overlay, { clientX: 150, clientY: 100 });
      fireEvent.mouseUp(overlay);

      expect(onRegionSelected).toHaveBeenCalledTimes(1);
      expect(onRegionSelected).toHaveBeenCalledWith({
        x: 50,
        y: 50,
        width: 100,
        height: 50,
      });
    });

    it("does not call onRegionSelected if selection is smaller than 10x10", () => {
      const onRegionSelected = vi.fn();
      const onCancel = vi.fn();
      render(
        <RegionSelector
          {...defaultProps}
          onRegionSelected={onRegionSelected}
          onCancel={onCancel}
        />
      );

      const overlay = screen.getByTestId("region-selector-overlay");

      // Create a too-small selection (5x5)
      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100, button: 0 });
      fireEvent.mouseMove(overlay, { clientX: 105, clientY: 105 });
      fireEvent.mouseUp(overlay);

      expect(onRegionSelected).not.toHaveBeenCalled();
    });

    it("calls onCancel if selection is too small", () => {
      const onCancel = vi.fn();
      render(<RegionSelector {...defaultProps} onCancel={onCancel} />);

      const overlay = screen.getByTestId("region-selector-overlay");

      // Create a too-small selection
      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100, button: 0 });
      fireEvent.mouseMove(overlay, { clientX: 105, clientY: 105 });
      fireEvent.mouseUp(overlay);

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("accepts selection exactly at minimum size (10x10)", () => {
      const onRegionSelected = vi.fn();
      render(
        <RegionSelector
          {...defaultProps}
          onRegionSelected={onRegionSelected}
        />
      );

      const overlay = screen.getByTestId("region-selector-overlay");

      // Create exactly 10x10 selection (should still be too small based on > check)
      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100, button: 0 });
      fireEvent.mouseMove(overlay, { clientX: 110, clientY: 110 });
      fireEvent.mouseUp(overlay);

      // Based on the original code, it uses > 10, so 10x10 is too small
      expect(onRegionSelected).not.toHaveBeenCalled();
    });

    it("accepts selection larger than minimum size (11x11)", () => {
      const onRegionSelected = vi.fn();
      render(
        <RegionSelector
          {...defaultProps}
          onRegionSelected={onRegionSelected}
        />
      );

      const overlay = screen.getByTestId("region-selector-overlay");

      // Create 11x11 selection (should be accepted)
      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100, button: 0 });
      fireEvent.mouseMove(overlay, { clientX: 111, clientY: 111 });
      fireEvent.mouseUp(overlay);

      expect(onRegionSelected).toHaveBeenCalledTimes(1);
      expect(onRegionSelected).toHaveBeenCalledWith({
        x: 100,
        y: 100,
        width: 11,
        height: 11,
      });
    });
  });

  describe("Keyboard Handling", () => {
    it("calls onCancel when Escape is pressed", () => {
      const onCancel = vi.fn();
      render(<RegionSelector {...defaultProps} onCancel={onCancel} />);

      // Press Escape key
      fireEvent.keyDown(document, { key: "Escape" });

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("does not call onCancel for other keys", () => {
      const onCancel = vi.fn();
      render(<RegionSelector {...defaultProps} onCancel={onCancel} />);

      // Press other keys
      fireEvent.keyDown(document, { key: "Enter" });
      fireEvent.keyDown(document, { key: "a" });

      expect(onCancel).not.toHaveBeenCalled();
    });

    it("does not listen for Escape when inactive", () => {
      const onCancel = vi.fn();
      render(<RegionSelector {...defaultProps} active={false} onCancel={onCancel} />);

      // Press Escape key
      fireEvent.keyDown(document, { key: "Escape" });

      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  describe("Mouse Button Handling", () => {
    it("only starts selection on left click (button 0)", () => {
      render(<RegionSelector {...defaultProps} active={true} />);

      const overlay = screen.getByTestId("region-selector-overlay");

      // Right click should not start selection
      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100, button: 2 });
      fireEvent.mouseMove(overlay, { clientX: 200, clientY: 200 });

      // Selection rectangle should not be visible
      expect(screen.queryByTestId("selection-rectangle")).toBeNull();
    });

    it("does not start selection on middle click", () => {
      render(<RegionSelector {...defaultProps} active={true} />);

      const overlay = screen.getByTestId("region-selector-overlay");

      // Middle click
      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100, button: 1 });
      fireEvent.mouseMove(overlay, { clientX: 200, clientY: 200 });

      expect(screen.queryByTestId("selection-rectangle")).toBeNull();
    });
  });

  describe("Selection State Reset", () => {
    it("resets selection state after successful selection", () => {
      const onRegionSelected = vi.fn();
      render(
        <RegionSelector
          {...defaultProps}
          onRegionSelected={onRegionSelected}
        />
      );

      const overlay = screen.getByTestId("region-selector-overlay");

      // Complete a selection
      fireEvent.mouseDown(overlay, { clientX: 50, clientY: 50, button: 0 });
      fireEvent.mouseMove(overlay, { clientX: 150, clientY: 150 });
      fireEvent.mouseUp(overlay);

      // Selection rectangle should be gone
      expect(screen.queryByTestId("selection-rectangle")).toBeNull();
    });

    it("resets selection state after cancelled selection", () => {
      const onCancel = vi.fn();
      render(<RegionSelector {...defaultProps} onCancel={onCancel} />);

      const overlay = screen.getByTestId("region-selector-overlay");

      // Create a too-small selection
      fireEvent.mouseDown(overlay, { clientX: 100, clientY: 100, button: 0 });
      fireEvent.mouseMove(overlay, { clientX: 105, clientY: 105 });
      fireEvent.mouseUp(overlay);

      // Selection rectangle should be gone
      expect(screen.queryByTestId("selection-rectangle")).toBeNull();
    });
  });
});
