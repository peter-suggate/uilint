/**
 * Tests for Popover component
 *
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
import { Popover } from "./Popover";

// Mock motion/react to avoid animation issues in tests
vi.mock("motion/react", () => {
  const React = require("react");
  const motion = new Proxy(
    {},
    {
      get(_target: unknown, prop: string) {
        return React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
          const filtered: Record<string, unknown> = {};
          for (const [key, val] of Object.entries(props)) {
            if (
              ![
                "initial",
                "animate",
                "exit",
                "transition",
                "whileHover",
                "whileTap",
                "layout",
                "variants",
              ].includes(key)
            ) {
              filtered[key] = val;
            }
          }
          return React.createElement(prop, { ...filtered, ref });
        });
      },
    }
  );
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    motion,
  };
});

describe("Popover", () => {
  beforeEach(() => {
    // Create portal root
    const portalRoot = document.createElement("div");
    portalRoot.id = "uilint-portal";
    document.body.appendChild(portalRoot);
  });

  afterEach(() => {
    cleanup();
    // Clean up portal root
    const portalRoot = document.getElementById("uilint-portal");
    if (portalRoot) {
      document.body.removeChild(portalRoot);
    }
  });

  describe("Rendering", () => {
    it("renders trigger element", () => {
      const onClose = vi.fn();
      render(
        <Popover
          open={false}
          onClose={onClose}
          trigger={<button>Open</button>}
        >
          <div>Content</div>
        </Popover>
      );

      expect(screen.getByText("Open")).toBeTruthy();
    });

    it("renders children when open", () => {
      const onClose = vi.fn();
      render(
        <Popover
          open={true}
          onClose={onClose}
          trigger={<button>Open</button>}
        >
          <div>Popover Content</div>
        </Popover>
      );

      expect(screen.getByText("Popover Content")).toBeTruthy();
    });

    it("does not render children when closed", () => {
      const onClose = vi.fn();
      render(
        <Popover
          open={false}
          onClose={onClose}
          trigger={<button>Open</button>}
        >
          <div>Popover Content</div>
        </Popover>
      );

      expect(screen.queryByText("Popover Content")).toBeNull();
    });
  });

  describe("Close Behavior", () => {
    it("calls onClose when Escape key is pressed", () => {
      const onClose = vi.fn();
      render(
        <Popover
          open={true}
          onClose={onClose}
          trigger={<button>Open</button>}
        >
          <div>Content</div>
        </Popover>
      );

      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("does not call onClose on Escape when closed", () => {
      const onClose = vi.fn();
      render(
        <Popover
          open={false}
          onClose={onClose}
          trigger={<button>Open</button>}
        >
          <div>Content</div>
        </Popover>
      );

      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("Props", () => {
    it("applies custom className to popover content", () => {
      const onClose = vi.fn();
      render(
        <Popover
          open={true}
          onClose={onClose}
          trigger={<button>Open</button>}
          className="custom-popover-class"
        >
          <div>Content</div>
        </Popover>
      );

      const popoverContent = screen.getByText("Content").parentElement;
      expect(popoverContent?.className).toContain("custom-popover-class");
    });

    it("accepts different placement values", () => {
      const onClose = vi.fn();
      const { rerender } = render(
        <Popover
          open={true}
          onClose={onClose}
          trigger={<button>Open</button>}
          placement="top"
        >
          <div>Content</div>
        </Popover>
      );
      expect(screen.getByText("Content")).toBeTruthy();

      rerender(
        <Popover
          open={true}
          onClose={onClose}
          trigger={<button>Open</button>}
          placement="bottom"
        >
          <div>Content</div>
        </Popover>
      );
      expect(screen.getByText("Content")).toBeTruthy();

      rerender(
        <Popover
          open={true}
          onClose={onClose}
          trigger={<button>Open</button>}
          placement="left"
        >
          <div>Content</div>
        </Popover>
      );
      expect(screen.getByText("Content")).toBeTruthy();

      rerender(
        <Popover
          open={true}
          onClose={onClose}
          trigger={<button>Open</button>}
          placement="right"
        >
          <div>Content</div>
        </Popover>
      );
      expect(screen.getByText("Content")).toBeTruthy();
    });

    it("accepts different align values", () => {
      const onClose = vi.fn();
      const { rerender } = render(
        <Popover
          open={true}
          onClose={onClose}
          trigger={<button>Open</button>}
          align="start"
        >
          <div>Content</div>
        </Popover>
      );
      expect(screen.getByText("Content")).toBeTruthy();

      rerender(
        <Popover
          open={true}
          onClose={onClose}
          trigger={<button>Open</button>}
          align="center"
        >
          <div>Content</div>
        </Popover>
      );
      expect(screen.getByText("Content")).toBeTruthy();

      rerender(
        <Popover
          open={true}
          onClose={onClose}
          trigger={<button>Open</button>}
          align="end"
        >
          <div>Content</div>
        </Popover>
      );
      expect(screen.getByText("Content")).toBeTruthy();
    });

    it("accepts numeric width", () => {
      const onClose = vi.fn();
      render(
        <Popover
          open={true}
          onClose={onClose}
          trigger={<button>Open</button>}
          width={300}
        >
          <div>Content</div>
        </Popover>
      );
      expect(screen.getByText("Content")).toBeTruthy();
    });
  });
});
