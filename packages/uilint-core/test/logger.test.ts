import { describe, it, expect, vi } from "vitest";
import {
  devLog,
  devWarn,
  devError,
  logInfo,
  logSuccess,
  logWarning,
  logError,
  logDebug,
  createProgress,
  pc,
} from "../src/logger.js";

describe("dev* functions (test-aware logging)", () => {
  it("devLog does not output during tests (VITEST=true)", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    devLog("test message");
    // IS_TEST is cached at module load, and we ARE in a test, so it should be silent
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("devWarn does not output during tests", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    devWarn("test warning");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("devError does not output during tests", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    devError("test error");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("log* functions (always output)", () => {
  it("logInfo outputs to stderr with info icon", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logInfo("Connected");
    expect(spy).toHaveBeenCalledTimes(1);
    const output = spy.mock.calls[0][0] as string;
    expect(output).toContain("Connected");
    spy.mockRestore();
  });

  it("logSuccess outputs with checkmark", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logSuccess("Done!");
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("logWarning outputs with warning icon", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logWarning("Watch out");
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("logError outputs with error icon", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logError("Failed");
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("logDebug outputs dimmed message", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logDebug("Debug info");
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe("createProgress", () => {
  it("writes initial message to stderr", () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    createProgress("Starting...");
    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls[0][0] as string;
    expect(output).toContain("Starting...");
    spy.mockRestore();
  });

  it("update clears previous line and writes new message", () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const progress = createProgress("Step 1");

    progress.update("Step 2");

    // Should have written the clear sequence and then the new message
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(3); // initial + clear + new
    spy.mockRestore();
  });

  it("succeed clears line and logs success", () => {
    const writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const progress = createProgress("Working...");
    progress.succeed("Complete!");

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const output = errorSpy.mock.calls[0][0] as string;
    expect(output).toContain("Complete!");

    writeSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("fail clears line and logs error", () => {
    const writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const progress = createProgress("Working...");
    progress.fail("Error occurred");

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const output = errorSpy.mock.calls[0][0] as string;
    expect(output).toContain("Error occurred");

    writeSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

describe("pc export", () => {
  it("exports picocolors for consistent styling", () => {
    expect(pc).toBeDefined();
    expect(typeof pc.red).toBe("function");
    expect(typeof pc.green).toBe("function");
    expect(typeof pc.blue).toBe("function");
  });
});
