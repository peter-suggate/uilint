"use client";

import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { DevTool } from "./DevTool";
import { injectDevToolStyles } from "./styles/inject-styles";

// Inlined CSS (compiled by Tailwind/PostCSS during Vite build)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Vite handles ?inline for CSS
import devtoolsCss from "./styles/globals.css?inline";

type DevtoolsPosition =
  | "bottom-left"
  | "bottom-right"
  | "top-left"
  | "top-right"
  | "top-center"
  | "bottom-center";

type DevtoolsTheme = "light" | "dark" | "system";

function setPositionAttributes(root: HTMLElement, position: DevtoolsPosition) {
  // We currently position the actual UI with fixed styles inside the toolbar code.
  // This attribute is reserved for future position overrides (and for CSS scoping).
  root.setAttribute("data-position", position);
}

/**
 * Detect the current theme from:
 * 1. Host app's .dark / .light class on html or body
 * 2. data-theme attribute on html or body
 * 3. System preference via prefers-color-scheme
 */
function detectTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";

  const html = document.documentElement;
  const body = document.body;

  // Check for explicit .dark / .light class (common pattern in Next.js/shadcn)
  if (html.classList.contains("dark") || body.classList.contains("dark")) {
    return "dark";
  }
  if (html.classList.contains("light") || body.classList.contains("light")) {
    return "light";
  }

  // Check data-theme attribute (common in many theme libraries)
  const htmlTheme = html.getAttribute("data-theme");
  const bodyTheme = body.getAttribute("data-theme");
  if (htmlTheme === "dark" || bodyTheme === "dark") {
    return "dark";
  }
  if (htmlTheme === "light" || bodyTheme === "light") {
    return "light";
  }

  // Check data-mode attribute (used by some theme libraries)
  const htmlMode = html.getAttribute("data-mode");
  const bodyMode = body.getAttribute("data-mode");
  if (htmlMode === "dark" || bodyMode === "dark") {
    return "dark";
  }
  if (htmlMode === "light" || bodyMode === "light") {
    return "light";
  }

  // Fall back to system preference
  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  return "light";
}

/**
 * Apply theme to the devtool root element
 */
function applyTheme(root: HTMLElement, theme: DevtoolsTheme) {
  // Remove existing theme classes
  root.classList.remove("light", "dark");
  root.removeAttribute("data-theme");

  if (theme === "system") {
    // Let CSS handle it via prefers-color-scheme
    // The globals.css has @media (prefers-color-scheme: dark) rules
    return;
  }

  // Apply explicit theme
  root.classList.add(theme);
  root.setAttribute("data-theme", theme);
}

export function defineUILintDevtoolsElement() {
  if (typeof window === "undefined") return;
  if (customElements.get("uilint-devtools")) return;

  class UILintDevtoolsElement extends HTMLElement {
    static get observedAttributes() {
      return ["enabled", "position", "theme"];
    }

    private rootEl: HTMLDivElement | null = null;
    private reactRoot: Root | null = null;
    private themeObserver: MutationObserver | null = null;
    private mediaQueryListener: (() => void) | null = null;

    connectedCallback() {
      injectDevToolStyles(devtoolsCss as string);

      // Mount into a dedicated container in <body>, not inside the custom element,
      // so we can use fixed positioning overlays without affecting layout.
      const container = document.createElement("div");
      container.className = "dev-tool-root";
      container.setAttribute("data-ui-lint-root", "true");
      document.body.appendChild(container);

      this.rootEl = container;
      setPositionAttributes(container, this.getPosition());
      this.syncTheme();

      // Watch for theme changes on html/body
      this.setupThemeObserver();

      this.reactRoot = createRoot(container);
      this.render();
    }

    disconnectedCallback() {
      this.reactRoot?.unmount();
      this.reactRoot = null;

      this.rootEl?.remove();
      this.rootEl = null;

      // Cleanup observers
      this.themeObserver?.disconnect();
      this.themeObserver = null;

      if (this.mediaQueryListener) {
        window
          .matchMedia("(prefers-color-scheme: dark)")
          .removeEventListener("change", this.mediaQueryListener);
        this.mediaQueryListener = null;
      }
    }

    attributeChangedCallback() {
      if (!this.rootEl) return;
      setPositionAttributes(this.rootEl, this.getPosition());
      this.syncTheme();
      this.render();
    }

    private getEnabled(): boolean {
      // enabled defaults to true; allow enabled="false" to disable.
      const raw = this.getAttribute("enabled");
      if (raw == null) return true;
      return raw !== "false";
    }

    private getPosition(): DevtoolsPosition {
      const raw = this.getAttribute("position");
      switch (raw) {
        case "bottom-right":
        case "top-left":
        case "top-right":
        case "bottom-left":
        case "top-center":
        case "bottom-center":
          return raw;
        default:
          // Default to top-center (matches FloatingIcon default)
          return "top-center";
      }
    }

    private getTheme(): DevtoolsTheme {
      const raw = this.getAttribute("theme");
      switch (raw) {
        case "light":
        case "dark":
          return raw;
        case "system":
        default:
          // Default to "system" which auto-detects from host app or system preference
          return "system";
      }
    }

    /**
     * Sync theme from attribute or auto-detect from host app
     */
    private syncTheme() {
      if (!this.rootEl) return;

      const themeAttr = this.getTheme();

      if (themeAttr === "system") {
        // Auto-detect from host app or system preference
        const detected = detectTheme();
        applyTheme(this.rootEl, detected);
      } else {
        // Use explicit theme from attribute
        applyTheme(this.rootEl, themeAttr);
      }
    }

    /**
     * Watch for theme changes in the host app
     */
    private setupThemeObserver() {
      // Watch for class/attribute changes on html and body
      this.themeObserver = new MutationObserver(() => {
        if (this.getTheme() === "system") {
          this.syncTheme();
        }
      });

      // Observe both html and body for class and attribute changes
      const observerConfig = {
        attributes: true,
        attributeFilter: ["class", "data-theme", "data-mode"],
      };

      this.themeObserver.observe(document.documentElement, observerConfig);
      this.themeObserver.observe(document.body, observerConfig);

      // Also watch for system preference changes
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      this.mediaQueryListener = () => {
        if (this.getTheme() === "system") {
          this.syncTheme();
        }
      };
      mediaQuery.addEventListener("change", this.mediaQueryListener);
    }

    private render() {
      if (!this.reactRoot) return;
      this.reactRoot.render(<DevTool enabled={this.getEnabled()} />);
    }
  }

  customElements.define("uilint-devtools", UILintDevtoolsElement);
}
