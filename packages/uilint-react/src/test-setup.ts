/**
 * Global test setup for vitest
 *
 * This file is loaded before all tests and sets up global mocks.
 */

import { vi } from "vitest";

// Mock uilint-core logging functions globally for all tests
vi.mock("uilint-core", () => ({
  devLog: vi.fn(),
  devWarn: vi.fn(),
  devError: vi.fn(),
}));
