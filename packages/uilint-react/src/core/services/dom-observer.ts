/**
 * DOM Observer Service
 *
 * A shared service that watches for elements with data-loc attributes.
 * Used to track DOM elements for source visualization and scanning.
 *
 * Features:
 * - MutationObserver-based tracking of data-loc elements
 * - Debounced reconciliation for handling streaming/suspense
 * - Subscribe/unsubscribe pattern for add/remove notifications
 * - Filtering for node_modules and UILint's own UI
 */

// =============================================================================
// Constants
// =============================================================================

/** The attribute used to identify source-mapped elements */
export const DATA_LOC_ATTR = "data-loc";

/** Debounce delay for reconciliation to handle rapid DOM changes */
export const RECONCILE_DEBOUNCE_MS = 100;

// =============================================================================
// Types
// =============================================================================

/**
 * Information about a scanned DOM element with data-loc attribute
 */
export interface ScannedElementInfo {
  /**
   * Unique per-instance ID derived from data-loc.
   * Format: "loc:path:line:column#occurrence"
   */
  id: string;
  /** The raw data-loc attribute value (path:line:column) */
  dataLoc: string;
  /** Reference to the DOM element */
  element: Element;
  /** Lowercase tag name of the element */
  tagName: string;
  /** Current bounding client rect */
  rect: DOMRect;
}

/** Handler called when new elements with data-loc are detected */
export type ElementAddedHandler = (elements: ScannedElementInfo[]) => void;

/** Handler called when elements with data-loc are removed */
export type ElementRemovedHandler = (elementIds: string[]) => void;

/**
 * Interface for the DOM Observer Service
 */
export interface DOMObserverService {
  /** Configure whether to filter out node_modules paths */
  setHideNodeModules(hide: boolean): void;
  /** Start observing the DOM */
  start(): void;
  /** Stop observing and clear state */
  stop(): void;
  /** Subscribe to element addition events, returns unsubscribe function */
  onElementsAdded(handler: ElementAddedHandler): () => void;
  /** Subscribe to element removal events, returns unsubscribe function */
  onElementsRemoved(handler: ElementRemovedHandler): () => void;
  /** Get all currently tracked elements */
  getElements(): ScannedElementInfo[];
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * DOM Observer Service Implementation
 *
 * Singleton service that tracks data-loc elements in the DOM.
 */
export class DOMObserverServiceImpl implements DOMObserverService {
  // ---------------------------------------------------------------------------
  // Private State
  // ---------------------------------------------------------------------------

  private observer: MutationObserver | null = null;
  private reconcileTimeout: ReturnType<typeof setTimeout> | null = null;
  private knownElements: Map<string, Element> = new Map();
  private addedHandlers: Set<ElementAddedHandler> = new Set();
  private removedHandlers: Set<ElementRemovedHandler> = new Set();
  private isRunning: boolean = false;
  private hideNodeModules: boolean = true;

  // ---------------------------------------------------------------------------
  // Public Methods
  // ---------------------------------------------------------------------------

  /**
   * Configure whether to filter out elements from node_modules
   */
  setHideNodeModules(hide: boolean): void {
    this.hideNodeModules = hide;
    // Re-reconcile if running to apply the new filter
    if (this.isRunning) {
      this.reconcile();
    }
  }

  /**
   * Start observing the DOM for data-loc elements
   */
  start(): void {
    // SSR guard
    if (typeof window === "undefined") {
      return;
    }

    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Create MutationObserver
    this.observer = new MutationObserver(this.handleMutations.bind(this));

    // Observe document.body for child additions/removals
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Run initial scan
    this.reconcile();
  }

  /**
   * Stop observing and clear all state
   */
  stop(): void {
    this.isRunning = false;

    // Disconnect observer
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    // Clear debounce timeout
    if (this.reconcileTimeout) {
      clearTimeout(this.reconcileTimeout);
      this.reconcileTimeout = null;
    }

    // Clear known elements
    this.knownElements.clear();
  }

  /**
   * Subscribe to element addition events
   * @returns Unsubscribe function
   */
  onElementsAdded(handler: ElementAddedHandler): () => void {
    this.addedHandlers.add(handler);
    return () => {
      this.addedHandlers.delete(handler);
    };
  }

  /**
   * Subscribe to element removal events
   * @returns Unsubscribe function
   */
  onElementsRemoved(handler: ElementRemovedHandler): () => void {
    this.removedHandlers.add(handler);
    return () => {
      this.removedHandlers.delete(handler);
    };
  }

  /**
   * Get all currently tracked elements
   */
  getElements(): ScannedElementInfo[] {
    return this.scanElements();
  }

  // ---------------------------------------------------------------------------
  // Private Methods
  // ---------------------------------------------------------------------------

  /**
   * Handle MutationObserver callbacks
   */
  private handleMutations(mutations: MutationRecord[]): void {
    let hasRelevantChanges = false;

    for (const mutation of mutations) {
      // Check added nodes
      for (const node of mutation.addedNodes) {
        if (this.hasDataLocElements(node)) {
          hasRelevantChanges = true;
          break;
        }
      }

      if (hasRelevantChanges) break;

      // Check removed nodes
      for (const node of mutation.removedNodes) {
        if (this.hasDataLocElements(node)) {
          hasRelevantChanges = true;
          break;
        }
      }

      if (hasRelevantChanges) break;
    }

    if (hasRelevantChanges) {
      this.debouncedReconcile();
    }
  }

  /**
   * Check if a node or its descendants have data-loc attributes
   */
  private hasDataLocElements(node: Node): boolean {
    if (!(node instanceof Element)) {
      return false;
    }

    // Check the node itself
    if (node.hasAttribute(DATA_LOC_ATTR)) {
      return true;
    }

    // Check descendants
    if (node.querySelector(`[${DATA_LOC_ATTR}]`)) {
      return true;
    }

    return false;
  }

  /**
   * Debounced reconciliation to handle rapid DOM updates
   */
  private debouncedReconcile(): void {
    if (this.reconcileTimeout) {
      clearTimeout(this.reconcileTimeout);
    }

    this.reconcileTimeout = setTimeout(() => {
      this.reconcile();
      this.reconcileTimeout = null;
    }, RECONCILE_DEBOUNCE_MS);
  }

  /**
   * Full reconciliation: scan DOM, diff with known elements, emit events
   */
  private reconcile(): void {
    // SSR guard
    if (typeof window === "undefined") {
      return;
    }

    // Scan current state
    const currentElements = this.scanElements();
    const currentById = new Map(currentElements.map((el) => [el.id, el]));
    const currentIds = new Set(currentById.keys());
    const knownIds = new Set(this.knownElements.keys());

    // Find added elements (in current but not known)
    const addedElements: ScannedElementInfo[] = [];
    for (const el of currentElements) {
      if (!knownIds.has(el.id)) {
        addedElements.push(el);
      }
    }

    // Find removed elements (in known but not current)
    const removedIds: string[] = [];
    for (const id of knownIds) {
      if (!currentIds.has(id)) {
        removedIds.push(id);
      }
    }

    // Update known elements map
    this.knownElements.clear();
    for (const el of currentElements) {
      this.knownElements.set(el.id, el.element);
    }

    // Emit added events
    if (addedElements.length > 0) {
      for (const handler of this.addedHandlers) {
        try {
          handler(addedElements);
        } catch (error) {
          console.error("[DOMObserverService] Error in added handler:", error);
        }
      }
    }

    // Emit removed events
    if (removedIds.length > 0) {
      for (const handler of this.removedHandlers) {
        try {
          handler(removedIds);
        } catch (error) {
          console.error(
            "[DOMObserverService] Error in removed handler:",
            error
          );
        }
      }
    }
  }

  /**
   * Scan the DOM for all elements with data-loc attributes
   */
  private scanElements(): ScannedElementInfo[] {
    // SSR guard
    if (typeof window === "undefined" || typeof document === "undefined") {
      return [];
    }

    const elements: ScannedElementInfo[] = [];

    // Track occurrences of each dataLoc to generate unique IDs
    const occurrenceByDataLoc = new Map<string, number>();

    // Query all elements with data-loc attribute
    const locElements = document.querySelectorAll(`[${DATA_LOC_ATTR}]`);

    for (const el of locElements) {
      // Skip elements inside UILint's own UI
      if (this.isInsideUILintUI(el)) {
        continue;
      }

      // Get the data-loc value
      let dataLoc = el.getAttribute(DATA_LOC_ATTR);
      if (!dataLoc) continue;

      // Normalize data-loc: strip runtime ID format if present
      // Runtime format: "loc:path:line:column#occurrence"
      if (dataLoc.startsWith("loc:")) {
        dataLoc = dataLoc.slice(4); // Remove "loc:" prefix
        const hashIndex = dataLoc.lastIndexOf("#");
        if (hashIndex !== -1) {
          dataLoc = dataLoc.slice(0, hashIndex); // Remove "#occurrence" suffix
        }
      }

      // Skip node_modules if filtering is enabled
      if (this.hideNodeModules && this.isNodeModulesPath(dataLoc)) {
        continue;
      }

      // Calculate occurrence number for this dataLoc
      const occurrence = (occurrenceByDataLoc.get(dataLoc) ?? 0) + 1;
      occurrenceByDataLoc.set(dataLoc, occurrence);

      // Generate unique ID
      const id = `loc:${dataLoc}#${occurrence}`;

      elements.push({
        id,
        dataLoc,
        element: el,
        tagName: el.tagName.toLowerCase(),
        rect: el.getBoundingClientRect(),
      });
    }

    return elements;
  }

  /**
   * Check if an element is inside UILint's own UI
   */
  private isInsideUILintUI(element: Element): boolean {
    return element.closest("[data-ui-lint]") !== null;
  }

  /**
   * Check if a path contains node_modules
   */
  private isNodeModulesPath(path: string): boolean {
    return path.includes("node_modules");
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

/**
 * Shared DOM observer service instance
 */
export const domObserver: DOMObserverService = new DOMObserverServiceImpl();
