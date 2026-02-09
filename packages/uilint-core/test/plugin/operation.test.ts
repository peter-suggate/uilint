import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createOperationInitialState,
  createOperationComputed,
  createOperationActions,
  createOperationMessageHandlers,
  type OperationState,
  type OperationProgress,
  type PluginContext,
} from "../../src/plugin/index.js";

// =============================================================================
// TEST HELPERS
// =============================================================================

interface TestStats {
  totalChunks: number;
  duration: number;
}

interface TestPluginState {
  indexing: OperationState<TestStats>;
  otherField: string;
}

/**
 * Creates a mock PluginContext for testing action handlers.
 */
function createMockContext(
  initialState: TestPluginState
): PluginContext<TestPluginState> & {
  currentState: TestPluginState;
  dispatched: Array<{ type: string; payload?: unknown }>;
} {
  let state = { ...initialState };
  const dispatched: Array<{ type: string; payload?: unknown }> = [];

  const ctx = {
    currentState: state,
    dispatched,
    getState: () => state,
    setState: (partial: Partial<TestPluginState>) => {
      state = { ...state, ...partial };
      ctx.currentState = state;
    },
    dispatch: vi.fn((actionType: string, payload?: unknown) => {
      dispatched.push({ type: actionType, payload });
    }),
    websocket: { isConnected: true, send: vi.fn() },
    getCurrentRoute: () => "/test",
    requestBrowserAction: vi.fn(),
    registerBrowserAction: vi.fn(),
    openInEditor: vi.fn(),
    setHeatmapFilter: vi.fn(),
    clearHeatmapFilter: vi.fn(),
    openInspector: vi.fn(),
    closeInspector: vi.fn(),
    requestOverlayInteraction: vi.fn(),
  };

  return ctx;
}

function defaultState(): TestPluginState {
  return {
    indexing: createOperationInitialState<TestStats>(),
    otherField: "preserved",
  };
}

// =============================================================================
// createOperationInitialState
// =============================================================================

describe("createOperationInitialState", () => {
  it("returns idle state with null fields", () => {
    const state = createOperationInitialState<TestStats>();

    expect(state).toEqual({
      status: "idle",
      progress: null,
      stats: null,
      lastError: null,
    });
  });

  it("returns a new object each call (no shared references)", () => {
    const a = createOperationInitialState();
    const b = createOperationInitialState();

    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

// =============================================================================
// createOperationComputed
// =============================================================================

describe("createOperationComputed", () => {
  const computed = createOperationComputed<TestPluginState>((s) => s.indexing);

  describe("isReady", () => {
    it("returns true when status is complete", () => {
      const state = defaultState();
      state.indexing.status = "complete";
      expect(computed.isReady(state)).toBe(true);
    });

    it("returns false for other statuses", () => {
      for (const status of ["idle", "active", "error"] as const) {
        const state = defaultState();
        state.indexing.status = status;
        expect(computed.isReady(state)).toBe(false);
      }
    });
  });

  describe("isActive", () => {
    it("returns true when status is active", () => {
      const state = defaultState();
      state.indexing.status = "active";
      expect(computed.isActive(state)).toBe(true);
    });

    it("returns false for other statuses", () => {
      for (const status of ["idle", "complete", "error"] as const) {
        const state = defaultState();
        state.indexing.status = status;
        expect(computed.isActive(state)).toBe(false);
      }
    });
  });

  describe("hasError", () => {
    it("returns true when status is error", () => {
      const state = defaultState();
      state.indexing.status = "error";
      expect(computed.hasError(state)).toBe(true);
    });

    it("returns true when lastError is non-null even if status is not error", () => {
      const state = defaultState();
      state.indexing.status = "complete";
      state.indexing.lastError = "lingering error";
      expect(computed.hasError(state)).toBe(true);
    });

    it("returns false when status is not error and lastError is null", () => {
      const state = defaultState();
      state.indexing.status = "idle";
      state.indexing.lastError = null;
      expect(computed.hasError(state)).toBe(false);
    });
  });

  describe("progressPercent", () => {
    it("returns 0 when progress is null", () => {
      const state = defaultState();
      expect(computed.progressPercent(state)).toBe(0);
    });

    it("returns 0 when total is 0 (avoid division by zero)", () => {
      const state = defaultState();
      state.indexing.progress = { current: 0, total: 0 };
      expect(computed.progressPercent(state)).toBe(0);
    });

    it("returns correct percentage", () => {
      const state = defaultState();
      state.indexing.progress = { current: 3, total: 10 };
      expect(computed.progressPercent(state)).toBe(30);
    });

    it("rounds to nearest integer", () => {
      const state = defaultState();
      state.indexing.progress = { current: 1, total: 3 };
      expect(computed.progressPercent(state)).toBe(33);
    });

    it("returns 100 when complete", () => {
      const state = defaultState();
      state.indexing.progress = { current: 10, total: 10 };
      expect(computed.progressPercent(state)).toBe(100);
    });
  });
});

// =============================================================================
// createOperationActions
// =============================================================================

describe("createOperationActions", () => {
  const actions = createOperationActions<TestPluginState, TestStats>(
    "indexing",
    {
      getOp: (s) => s.indexing,
      setOp: (op) => ({ indexing: op }),
    }
  );

  it("creates four handlers with prefixed keys", () => {
    expect(Object.keys(actions)).toEqual([
      "handle-indexing-start",
      "handle-indexing-progress",
      "handle-indexing-complete",
      "handle-indexing-error",
    ]);
  });

  describe("handle-{prefix}-start", () => {
    it("sets status to active with empty progress and clears error", () => {
      const state = defaultState();
      state.indexing.lastError = "old error";
      state.indexing.stats = { totalChunks: 10, duration: 500 };
      const ctx = createMockContext(state);

      actions["handle-indexing-start"](ctx, undefined);

      expect(ctx.currentState.indexing.status).toBe("active");
      expect(ctx.currentState.indexing.progress).toEqual({
        current: 0,
        total: 0,
      });
      expect(ctx.currentState.indexing.lastError).toBeNull();
      // stats from previous run should be preserved
      expect(ctx.currentState.indexing.stats).toEqual({
        totalChunks: 10,
        duration: 500,
      });
    });

    it("preserves other plugin state fields", () => {
      const ctx = createMockContext(defaultState());

      actions["handle-indexing-start"](ctx, undefined);

      expect(ctx.currentState.otherField).toBe("preserved");
    });
  });

  describe("handle-{prefix}-progress", () => {
    it("updates progress from payload", () => {
      const state = defaultState();
      state.indexing.status = "active";
      const ctx = createMockContext(state);

      const progress: OperationProgress = {
        current: 5,
        total: 20,
        message: "Processing file.ts",
      };

      actions["handle-indexing-progress"](ctx, progress);

      expect(ctx.currentState.indexing.status).toBe("active");
      expect(ctx.currentState.indexing.progress).toEqual(progress);
    });

    it("ensures status is active even if not already", () => {
      const ctx = createMockContext(defaultState());

      actions["handle-indexing-progress"](ctx, {
        current: 1,
        total: 10,
      });

      expect(ctx.currentState.indexing.status).toBe("active");
    });
  });

  describe("handle-{prefix}-complete", () => {
    it("sets status to complete with stats and clears progress/error", () => {
      const state = defaultState();
      state.indexing.status = "active";
      state.indexing.progress = { current: 10, total: 10 };
      state.indexing.lastError = "old";
      const ctx = createMockContext(state);

      const stats: TestStats = { totalChunks: 42, duration: 1200 };
      actions["handle-indexing-complete"](ctx, stats);

      expect(ctx.currentState.indexing.status).toBe("complete");
      expect(ctx.currentState.indexing.progress).toBeNull();
      expect(ctx.currentState.indexing.stats).toEqual(stats);
      expect(ctx.currentState.indexing.lastError).toBeNull();
    });
  });

  describe("handle-{prefix}-error", () => {
    it("sets status to error with message and clears progress", () => {
      const state = defaultState();
      state.indexing.status = "active";
      state.indexing.progress = { current: 5, total: 10 };
      const ctx = createMockContext(state);

      actions["handle-indexing-error"](ctx, {
        error: "Connection lost",
      });

      expect(ctx.currentState.indexing.status).toBe("error");
      expect(ctx.currentState.indexing.progress).toBeNull();
      expect(ctx.currentState.indexing.lastError).toBe("Connection lost");
    });

    it("preserves stats from a previous successful run", () => {
      const state = defaultState();
      state.indexing.stats = { totalChunks: 10, duration: 300 };
      const ctx = createMockContext(state);

      actions["handle-indexing-error"](ctx, { error: "fail" });

      expect(ctx.currentState.indexing.stats).toEqual({
        totalChunks: 10,
        duration: 300,
      });
    });
  });

  describe("different prefix", () => {
    it("uses custom prefix for action keys", () => {
      const analysisActions = createOperationActions<TestPluginState, TestStats>(
        "analysis",
        {
          getOp: (s) => s.indexing,
          setOp: (op) => ({ indexing: op }),
        }
      );

      expect(Object.keys(analysisActions)).toEqual([
        "handle-analysis-start",
        "handle-analysis-progress",
        "handle-analysis-complete",
        "handle-analysis-error",
      ]);
    });
  });
});

// =============================================================================
// createOperationMessageHandlers
// =============================================================================

describe("createOperationMessageHandlers", () => {
  describe("with all message types", () => {
    const handlers = createOperationMessageHandlers<TestPluginState>({
      actionPrefix: "indexing",
      startMessage: "my:indexing:start",
      progressMessage: "my:indexing:progress",
      completeMessage: "my:indexing:complete",
      errorMessage: "my:indexing:error",
      extractProgress: (msg) => {
        const m = msg as { current: number; total: number; text: string };
        return { current: m.current, total: m.total, message: m.text };
      },
      extractStats: (msg) => {
        const m = msg as { chunks: number; time: number };
        return { totalChunks: m.chunks, duration: m.time };
      },
      extractError: (msg) => (msg as { reason: string }).reason,
    });

    it("creates handlers for all four message types", () => {
      expect(Object.keys(handlers).sort()).toEqual([
        "my:indexing:complete",
        "my:indexing:error",
        "my:indexing:progress",
        "my:indexing:start",
      ]);
    });

    it("start handler dispatches handle-{prefix}-start", () => {
      const ctx = createMockContext(defaultState());
      handlers["my:indexing:start"](ctx, {});
      expect(ctx.dispatch).toHaveBeenCalledWith("handle-indexing-start");
    });

    it("progress handler extracts and dispatches progress", () => {
      const ctx = createMockContext(defaultState());
      handlers["my:indexing:progress"](ctx, {
        current: 3,
        total: 10,
        text: "file.ts",
      });
      expect(ctx.dispatch).toHaveBeenCalledWith("handle-indexing-progress", {
        current: 3,
        total: 10,
        message: "file.ts",
      });
    });

    it("complete handler extracts stats and dispatches", () => {
      const ctx = createMockContext(defaultState());
      handlers["my:indexing:complete"](ctx, { chunks: 42, time: 1200 });
      expect(ctx.dispatch).toHaveBeenCalledWith("handle-indexing-complete", {
        totalChunks: 42,
        duration: 1200,
      });
    });

    it("error handler extracts error and dispatches", () => {
      const ctx = createMockContext(defaultState());
      handlers["my:indexing:error"](ctx, { reason: "timeout" });
      expect(ctx.dispatch).toHaveBeenCalledWith("handle-indexing-error", {
        error: "timeout",
      });
    });
  });

  describe("without startMessage", () => {
    it("omits start handler when startMessage is not configured", () => {
      const handlers = createOperationMessageHandlers<TestPluginState>({
        actionPrefix: "analysis",
        progressMessage: "analysis:progress",
        completeMessage: "analysis:complete",
        errorMessage: "analysis:error",
      });

      expect(Object.keys(handlers)).not.toContain(expect.stringContaining("start"));
      expect(Object.keys(handlers)).toHaveLength(3);
    });
  });

  describe("default extractors", () => {
    const handlers = createOperationMessageHandlers<TestPluginState>({
      actionPrefix: "indexing",
      progressMessage: "progress",
      completeMessage: "complete",
      errorMessage: "error",
    });

    it("passes message as-is for progress when no extractor", () => {
      const ctx = createMockContext(defaultState());
      const msg = { current: 5, total: 10 };
      handlers["progress"](ctx, msg);
      expect(ctx.dispatch).toHaveBeenCalledWith(
        "handle-indexing-progress",
        msg
      );
    });

    it("passes message as-is for complete when no extractor", () => {
      const ctx = createMockContext(defaultState());
      const msg = { totalChunks: 42 };
      handlers["complete"](ctx, msg);
      expect(ctx.dispatch).toHaveBeenCalledWith(
        "handle-indexing-complete",
        msg
      );
    });

    it("extracts error field by default when no extractor", () => {
      const ctx = createMockContext(defaultState());
      handlers["error"](ctx, { error: "something broke" });
      expect(ctx.dispatch).toHaveBeenCalledWith("handle-indexing-error", {
        error: "something broke",
      });
    });
  });
});

// =============================================================================
// INTEGRATION: Full lifecycle simulation
// =============================================================================

describe("full lifecycle integration", () => {
  const actions = createOperationActions<TestPluginState, TestStats>(
    "indexing",
    {
      getOp: (s) => s.indexing,
      setOp: (op) => ({ indexing: op }),
    }
  );
  const computed = createOperationComputed<TestPluginState>((s) => s.indexing);

  it("walks through idle → active → complete lifecycle", () => {
    const ctx = createMockContext(defaultState());

    // Initially idle
    expect(computed.isActive(ctx.currentState)).toBe(false);
    expect(computed.isReady(ctx.currentState)).toBe(false);

    // Start
    actions["handle-indexing-start"](ctx, undefined);
    expect(computed.isActive(ctx.currentState)).toBe(true);
    expect(computed.progressPercent(ctx.currentState)).toBe(0);

    // Progress 50%
    actions["handle-indexing-progress"](ctx, {
      current: 5,
      total: 10,
      message: "halfway",
    });
    expect(computed.progressPercent(ctx.currentState)).toBe(50);
    expect(ctx.currentState.indexing.progress?.message).toBe("halfway");

    // Complete
    const stats: TestStats = { totalChunks: 100, duration: 2000 };
    actions["handle-indexing-complete"](ctx, stats);
    expect(computed.isActive(ctx.currentState)).toBe(false);
    expect(computed.isReady(ctx.currentState)).toBe(true);
    expect(ctx.currentState.indexing.stats).toEqual(stats);
    expect(computed.progressPercent(ctx.currentState)).toBe(0);
  });

  it("walks through idle → active → error lifecycle", () => {
    const ctx = createMockContext(defaultState());

    actions["handle-indexing-start"](ctx, undefined);
    actions["handle-indexing-progress"](ctx, { current: 3, total: 10 });

    actions["handle-indexing-error"](ctx, { error: "Network timeout" });

    expect(computed.isActive(ctx.currentState)).toBe(false);
    expect(computed.hasError(ctx.currentState)).toBe(true);
    expect(ctx.currentState.indexing.lastError).toBe("Network timeout");
    expect(ctx.currentState.indexing.progress).toBeNull();
  });

  it("can restart after error", () => {
    const ctx = createMockContext(defaultState());

    // First run fails
    actions["handle-indexing-start"](ctx, undefined);
    actions["handle-indexing-error"](ctx, { error: "fail" });
    expect(computed.hasError(ctx.currentState)).toBe(true);

    // Restart
    actions["handle-indexing-start"](ctx, undefined);
    expect(computed.isActive(ctx.currentState)).toBe(true);
    expect(computed.hasError(ctx.currentState)).toBe(false);
    expect(ctx.currentState.indexing.lastError).toBeNull();
  });

  it("can restart after completion (re-index)", () => {
    const ctx = createMockContext(defaultState());

    // First run completes
    actions["handle-indexing-start"](ctx, undefined);
    actions["handle-indexing-complete"](ctx, {
      totalChunks: 50,
      duration: 1000,
    });
    expect(computed.isReady(ctx.currentState)).toBe(true);

    // Restart -- previous stats preserved until new completion
    actions["handle-indexing-start"](ctx, undefined);
    expect(computed.isActive(ctx.currentState)).toBe(true);
    expect(ctx.currentState.indexing.stats).toEqual({
      totalChunks: 50,
      duration: 1000,
    });
  });
});
