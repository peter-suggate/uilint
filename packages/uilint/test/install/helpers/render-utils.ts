/**
 * Ink testing utilities - wrappers around ink-testing-library
 */

import { render as inkRender } from "ink-testing-library";
import type { ReactElement } from "react";

/**
 * Render an Ink component for testing
 *
 * @param element - React element to render
 * @returns ink-testing-library instance with helpers
 */
export function renderInk(element: ReactElement) {
  return inkRender(element);
}

/**
 * Wait for condition to be true, with timeout
 *
 * @param condition - Function that returns true when ready
 * @param timeout - Max milliseconds to wait (default 5000)
 * @param interval - Check interval in milliseconds (default 50)
 */
export async function waitFor(
  condition: () => boolean,
  timeout = 5000,
  interval = 50
): Promise<void> {
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error(`Timeout waiting for condition after ${timeout}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

/**
 * Wait for text to appear in output
 *
 * @param getLastFrame - Function that returns current frame
 * @param text - Text to wait for
 * @param timeout - Max milliseconds to wait
 */
export async function waitForText(
  getLastFrame: () => string,
  text: string,
  timeout = 5000
): Promise<void> {
  await waitFor(() => getLastFrame().includes(text), timeout);
}

/**
 * Get all lines from frame output
 *
 * @param frame - Frame string from lastFrame()
 * @returns Array of lines
 */
export function getLines(frame: string): string[] {
  return frame.split("\n").filter((line) => line.trim().length > 0);
}

/**
 * Check if frame contains text
 *
 * @param frame - Frame string from lastFrame()
 * @param text - Text to search for
 * @returns true if text is found
 */
export function frameContains(frame: string, text: string): boolean {
  return frame.includes(text);
}
