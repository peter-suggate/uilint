/**
 * Global test setup for vitest
 *
 * The uilint-core logging functions (devLog, devWarn, devError) are already
 * test-aware and silently skip logging when VITEST=true. No mocking needed.
 */

// This file is intentionally minimal - uilint-core handles test detection automatically
