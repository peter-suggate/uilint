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
 * - Dependency injection for testability
 */

// =============================================================================
// Constants
// =============================================================================

/** The attribute used to identify source-mapped elements */
export const DATA_LOC_ATTR = "data-loc";

/** Debounce delay for reconciliation to handle rapid DOM changes */
export const RECONCILE_DEBOUNCE_MS = 100;

// =============================================================================
// Pure Functions (Testable without DOM)
// =============================================================================

/**
 * Generate a unique element ID from data-loc and occurrence number
 * @param dataLoc - The parsed data-loc value (path:line:column)
 * @param occurrence - The occurrence number (1-based) for elements with same dataLoc
 * @returns Unique ID in format "loc:path:line:column#occurrence"
 */
export function generateElementId(dataLoc: string, occurrence: number): string {
  return `loc:${dataLoc}#${occurrence}`;
}

/**
 * Parse a raw data-loc attribute value, normalizing runtime ID format if present
 * @param rawDataLoc - The raw data-loc attribute value
 * @returns The normalized data-loc value (path:line:column) or null if invalid
 */
export function parseDataLoc(rawDataLoc: string): string | null {
  if (!rawDataLoc) {
    return null;
  }

  let dataLoc = rawDataLoc;

  // Normalize data-loc: strip runtime ID format if present
  // Runtime format: "loc:path:line:column#occurrence"
  if (dataLoc.startsWith("loc:")) {
    dataLoc = dataLoc.slice(4); // Remove "loc:" prefix
    const hashIndex = dataLoc.lastIndexOf("#");
    if (hashIndex !== -1) {
      dataLoc = dataLoc.slice(0, hashIndex); // Remove "#occurrence" suffix
    }
  }

  return dataLoc || null;
}

/**
 * Check if a path should be filtered based on node_modules presence
 * @param path - The file path to check
 * @param hideNodeModules - Whether to filter node_modules paths
 * @returns True if the path should be filtered out
 */
export function shouldFilterPath(
  path: string,
  hideNodeModules: boolean
): boolean {
  return hideNodeModules && path.includes("node_modules");
}

// =============================================================================
// Types
// =============================================================================

/**
 * Options for creating a DOMObserverService instance
 * Enables dependency injection for testing
 */
export interface DOMObserverOptions {
  /** Root element to observe (defaults to document.body) */
  root?: Element;
  /** MutationObserver implementation (defaults to window.MutationObserver) */
  MutationObserverImpl?: typeof MutationObserver;
  /** Custom querySelectorAll function (defaults to document.querySelectorAll) */
  querySelectorAll?: (selector: string) => NodeListOf<Element>;
}

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
 * Service that tracks data-loc elements in the DOM.
 * Supports dependency injection for testability.
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

  // Injected dependencies
  private readonly options: DOMObserverOptions;

  // ---------------------------------------------------------------------------
  // Constructor
  // ---------------------------------------------------------------------------

  /**
   * Create a new DOMObserverService instance
   * @param options - Optional configuration for dependency injection
   */
  constructor(options: DOMObserverOptions = {}) {
    this.options = options;
  }

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
    // SSR guard - skip if no window/document and no injected dependencies
    if (typeof window === "undefined" && !this.options.root) {
      return;
    }

    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    // Get MutationObserver implementation (injected or global)
    const MutationObserverImpl =
      this.options.MutationObserverImpl ??
      (typeof window !== "undefined" ? window.MutationObserver : undefined);

    // Get root element (injected or document.body)
    const root =
      this.options.root ??
      (typeof document !== "undefined" ? document.body : undefined);

    // Create MutationObserver if implementation is available
    if (MutationObserverImpl && root) {
      this.observer = new MutationObserverImpl(
        this.handleMutations.bind(this)
      );

      // Observe root element for child additions/removals
      this.observer.observe(root, {
        childList: true,
        subtree: true,
      });
    }

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
    // Get querySelectorAll function (injected or from document)
    const querySelectorAllFn =
      this.options.querySelectorAll ??
      (typeof document !== "undefined"
        ? document.querySelectorAll.bind(document)
        : undefined);

    // SSR guard - skip if no query function available
    if (!querySelectorAllFn) {
      return [];
    }

    const elements: ScannedElementInfo[] = [];

    // Track occurrences of each dataLoc to generate unique IDs
    const occurrenceByDataLoc = new Map<string, number>();

    // Query all elements with data-loc attribute
    const locElements = querySelectorAllFn(`[${DATA_LOC_ATTR}]`);

    for (const el of locElements) {
      // Skip elements inside UILint's own UI
      if (this.isInsideUILintUI(el)) {
        continue;
      }

      // Get and parse the data-loc value using pure function
      const rawDataLoc = el.getAttribute(DATA_LOC_ATTR);
      const dataLoc = parseDataLoc(rawDataLoc ?? "");
      if (!dataLoc) continue;

      // Skip node_modules if filtering is enabled using pure function
      if (shouldFilterPath(dataLoc, this.hideNodeModules)) {
        continue;
      }

      // Calculate occurrence number for this dataLoc
      const occurrence = (occurrenceByDataLoc.get(dataLoc) ?? 0) + 1;
      occurrenceByDataLoc.set(dataLoc, occurrence);

      // Generate unique ID using pure function
      const id = generateElementId(dataLoc, occurrence);

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
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new DOMObserverService instance with optional dependency injection
 * @param options - Optional configuration for dependency injection (useful for testing)
 * @returns A new DOMObserverService instance
 */
export function createDOMObserverService(
  options?: DOMObserverOptions
): DOMObserverService {
  return new DOMObserverServiceImpl(options);
}

// =============================================================================
// Singleton Export (Backward Compatibility)
// =============================================================================

/**
 * Shared DOM observer service instance
 * @deprecated Use createDOMObserverService() for new code that needs testability
 */
export const domObserver: DOMObserverService = new DOMObserverServiceImpl();
