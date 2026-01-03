/**
 * DOM snapshotting for consistency analysis
 */

import type {
  ElementSnapshot,
  ElementRole,
  StyleSnapshot,
  GroupedSnapshot,
} from "./types";

/** Data attribute used to mark elements for highlight lookup */
const DATA_ELEMENTS_ATTR = "data-elements";

/** Elements to skip during DOM walk */
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "SVG", "NOSCRIPT", "TEMPLATE"]);

/** Semantic context elements */
const CONTEXT_ELEMENTS = new Set([
  "HEADER",
  "NAV",
  "MAIN",
  "FOOTER",
  "SECTION",
  "ARTICLE",
  "ASIDE",
]);

/** Class patterns for role inference */
const CLASS_PATTERNS: Record<string, RegExp> = {
  button: /\b(btn|button)\b/i,
  card: /\b(card)\b/i,
  input: /\b(input|field|form-control)\b/i,
  link: /\b(link)\b/i,
};

let elementCounter = 0;

/**
 * Cleans up data-elements attributes from previous scans
 */
export function cleanupDataElements(): void {
  const elements = document.querySelectorAll(`[${DATA_ELEMENTS_ATTR}]`);
  elements.forEach((el) => el.removeAttribute(DATA_ELEMENTS_ATTR));
  elementCounter = 0;
}

/**
 * Generates a unique element ID
 */
function generateElementId(): string {
  return `el-${++elementCounter}`;
}

/**
 * Truncates text to max length
 */
function truncateText(text: string, maxLen: number = 50): string {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen - 3) + "...";
}

/**
 * Infers element role from various sources
 * Order: ARIA role > tag name > data-ui-component > class patterns
 */
function inferRole(el: Element, styles: CSSStyleDeclaration): ElementRole {
  // Check ARIA role
  const ariaRole = el.getAttribute("role");
  if (ariaRole) {
    if (ariaRole === "button") return "button";
    if (ariaRole === "link") return "link";
    if (ariaRole === "textbox" || ariaRole === "searchbox") return "input";
    if (ariaRole === "heading") return "heading";
  }

  // Check tag name
  const tag = el.tagName.toUpperCase();
  if (tag === "BUTTON") return "button";
  if (tag === "A") return "link";
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return "input";
  if (/^H[1-6]$/.test(tag)) return "heading";

  // Check data-ui-component
  const component = el.getAttribute("data-ui-component");
  if (component) {
    const lower = component.toLowerCase();
    if (lower.includes("button")) return "button";
    if (lower.includes("card")) return "card";
    if (lower.includes("input") || lower.includes("field")) return "input";
    if (lower.includes("link")) return "link";
  }

  // Check class patterns
  const className = el.className;
  if (typeof className === "string") {
    if (CLASS_PATTERNS.button.test(className)) return "button";
    if (CLASS_PATTERNS.card.test(className)) return "card";
    if (CLASS_PATTERNS.input.test(className)) return "input";
    if (CLASS_PATTERNS.link.test(className)) return "link";
  }

  // Check if it's a card-like element
  if (isCard(el, styles)) return "card";

  // Check if it's a container
  if (isContainer(styles)) return "container";

  // Check if it has meaningful text (not just whitespace)
  const text = el.textContent?.trim() || "";
  if (text.length > 0 && text.length < 200) return "text";

  return "other";
}

/**
 * Detects card-like elements
 * Heuristic: has children AND (has box-shadow OR (has background + border-radius) OR (has border + border-radius))
 */
function isCard(el: Element, styles: CSSStyleDeclaration): boolean {
  if (el.children.length === 0) return false;

  const hasBoxShadow =
    styles.boxShadow && styles.boxShadow !== "none";
  const hasBg =
    styles.backgroundColor &&
    styles.backgroundColor !== "transparent" &&
    styles.backgroundColor !== "rgba(0, 0, 0, 0)";
  const hasBorder =
    styles.border && styles.border !== "none" && !styles.border.includes("0px");
  const hasRadius =
    styles.borderRadius && styles.borderRadius !== "0px";

  return Boolean(hasBoxShadow || ((hasBg || hasBorder) && hasRadius));
}

/**
 * Detects container elements
 * Heuristic: display flex/grid with gap or notable padding
 */
function isContainer(styles: CSSStyleDeclaration): boolean {
  const display = styles.display;
  if (display !== "flex" && display !== "grid") return false;

  const gap = styles.gap;
  if (gap && gap !== "normal" && gap !== "0px") return true;

  const padding = styles.padding;
  if (padding && padding !== "0px") {
    // Check if padding is significant (> 8px)
    const match = padding.match(/(\d+)px/);
    if (match && parseInt(match[1], 10) > 8) return true;
  }

  return false;
}

/**
 * Builds context string from ancestor semantic elements
 */
function buildContext(el: Element): string {
  const parts: string[] = [];
  let current = el.parentElement;

  while (current && parts.length < 3) {
    const tag = current.tagName.toUpperCase();
    if (CONTEXT_ELEMENTS.has(tag)) {
      parts.unshift(tag.toLowerCase());
    }
    current = current.parentElement;
  }

  return parts.join(" > ") || "root";
}

/**
 * Extracts relevant computed styles
 */
function extractStyles(styles: CSSStyleDeclaration): StyleSnapshot {
  return {
    fontSize: styles.fontSize || undefined,
    fontWeight: styles.fontWeight || undefined,
    color: styles.color || undefined,
    backgroundColor:
      styles.backgroundColor === "rgba(0, 0, 0, 0)"
        ? undefined
        : styles.backgroundColor || undefined,
    padding: styles.padding === "0px" ? undefined : styles.padding || undefined,
    borderRadius:
      styles.borderRadius === "0px"
        ? undefined
        : styles.borderRadius || undefined,
    border:
      styles.border === "none" || styles.border?.includes("0px")
        ? undefined
        : styles.border || undefined,
    boxShadow:
      styles.boxShadow === "none" ? undefined : styles.boxShadow || undefined,
    gap:
      styles.gap === "normal" || styles.gap === "0px"
        ? undefined
        : styles.gap || undefined,
  };
}

/**
 * Checks if an element should be skipped
 */
function shouldSkip(el: Element): boolean {
  // Skip by tag
  if (SKIP_TAGS.has(el.tagName.toUpperCase())) return true;

  // Skip elements with data-ui-lint-ignore
  if (el.hasAttribute("data-ui-lint-ignore")) return true;

  // Skip aria-hidden elements
  if (el.getAttribute("aria-hidden") === "true") return true;

  // Skip hidden elements
  const styles = window.getComputedStyle(el);
  if (styles.display === "none" || styles.visibility === "hidden") return true;

  return false;
}

/**
 * Creates a snapshot of a single element
 */
function snapshotElement(el: Element): ElementSnapshot | null {
  if (shouldSkip(el)) return null;

  const styles = window.getComputedStyle(el);
  const role = inferRole(el, styles);

  // Only capture elements with meaningful roles
  if (role === "other") return null;

  const id = generateElementId();
  el.setAttribute(DATA_ELEMENTS_ATTR, id);

  const rect = el.getBoundingClientRect();
  const text =
    el.textContent?.trim().slice(0, 100) ||
    el.getAttribute("aria-label") ||
    "";

  return {
    id,
    tag: el.tagName.toLowerCase(),
    role,
    text: truncateText(text),
    component: el.getAttribute("data-ui-component") || undefined,
    context: buildContext(el),
    styles: extractStyles(styles),
    rect: {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
  };
}

/**
 * Creates a grouped snapshot of DOM elements for consistency analysis
 */
export function createSnapshot(root?: Element): GroupedSnapshot {
  // Clean up previous scan
  cleanupDataElements();

  const targetRoot = root || document.body;
  const snapshot: GroupedSnapshot = {
    buttons: [],
    headings: [],
    cards: [],
    links: [],
    inputs: [],
    containers: [],
  };

  // Walk the DOM
  const walker = document.createTreeWalker(
    targetRoot,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        const el = node as Element;
        if (shouldSkip(el)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  let node: Node | null = walker.currentNode;
  while (node) {
    if (node instanceof Element) {
      const elementSnapshot = snapshotElement(node);
      if (elementSnapshot) {
        // Add to appropriate group
        switch (elementSnapshot.role) {
          case "button":
            snapshot.buttons.push(elementSnapshot);
            break;
          case "heading":
            snapshot.headings.push(elementSnapshot);
            break;
          case "card":
            snapshot.cards.push(elementSnapshot);
            break;
          case "link":
            snapshot.links.push(elementSnapshot);
            break;
          case "input":
            snapshot.inputs.push(elementSnapshot);
            break;
          case "container":
            snapshot.containers.push(elementSnapshot);
            break;
        }
      }
    }
    node = walker.nextNode();
  }

  return snapshot;
}

/**
 * Gets an element by its data-elements ID
 */
export function getElementBySnapshotId(id: string): Element | null {
  return document.querySelector(`[${DATA_ELEMENTS_ATTR}="${id}"]`);
}
