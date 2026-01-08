import { describe, expect, it } from "vitest";
import { computeInspectionPanelPosition } from "./inspection-panel-positioning";

describe("computeInspectionPanelPosition", () => {
  const viewport = { width: 1000, height: 800 };
  const popover = { width: 380, height: 450 };
  const padding = 12;

  it("prefers right placement when there is space", () => {
    const rect = {
      top: 100,
      left: 100,
      right: 300,
      bottom: 200,
      width: 200,
      height: 100,
    };

    const pos = computeInspectionPanelPosition({
      rect,
      popover,
      viewport,
      padding,
    });
    expect(pos.placement).toBe("right");
    expect(pos.left).toBe(rect.right + padding);
  });

  it("falls back to a non-right placement when right would overflow (stays close to badge)", () => {
    const rect = {
      top: 100,
      left: 700,
      right: 950,
      bottom: 200,
      width: 250,
      height: 100,
    };

    const pos = computeInspectionPanelPosition({
      rect,
      popover,
      viewport,
      padding,
    });
    expect(pos.placement).not.toBe("right");
    // still clamped in-bounds
    expect(pos.left).toBeGreaterThanOrEqual(padding);
    expect(pos.top).toBeGreaterThanOrEqual(padding);
    expect(pos.left + popover.width).toBeLessThanOrEqual(
      viewport.width - padding
    );
    expect(pos.top + popover.height).toBeLessThanOrEqual(
      viewport.height - padding
    );
  });

  it("clamps within viewport when element is near the top", () => {
    const rect = {
      top: 0,
      left: 100,
      right: 300,
      bottom: 20,
      width: 200,
      height: 20,
    };

    const pos = computeInspectionPanelPosition({
      rect,
      popover,
      viewport,
      padding,
    });
    expect(pos.top).toBe(padding);
  });

  it("chooses a placement that stays close to the badge when space is tight", () => {
    const tightViewport = { width: 420, height: 600 };
    const rect = {
      top: 200,
      left: 10,
      right: 410,
      bottom: 260,
      width: 400,
      height: 60,
    };

    const pos = computeInspectionPanelPosition({
      rect,
      popover: { width: 380, height: 300 },
      viewport: tightViewport,
      padding,
    });

    // should still be clamped in-bounds
    expect(pos.left).toBeGreaterThanOrEqual(padding);
    expect(pos.top).toBeGreaterThanOrEqual(padding);
    expect(pos.left + 380).toBeLessThanOrEqual(tightViewport.width - padding);
    expect(pos.top + 300).toBeLessThanOrEqual(tightViewport.height - padding);
  });
});
