/**
 * Tests for useListNavigation hook
 *
 * Tests 1D keyboard navigation for the command palette result list.
 * Covers ArrowDown, ArrowUp, Enter, Escape, Tab, Home, End keys.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import React from "react";
import { useListNavigation } from "./useListNavigation";
import type { SearchItem } from "../../core/plugin-system/types";

// ============================================================================
// Test Helpers
// ============================================================================

function createSearchItem(overrides: Partial<SearchItem> = {}): SearchItem {
  return {
    id: `item-${Math.random().toString(36).slice(2)}`,
    section: "rules",
    label: "Test Item",
    searchFields: { label: "Test Item" },
    ...overrides,
  };
}

function createKeyboardEvent(key: string): React.KeyboardEvent {
  return {
    key,
    preventDefault: vi.fn(),
  } as unknown as React.KeyboardEvent;
}

const mockItems: SearchItem[] = [
  createSearchItem({ id: "item-0", label: "First Item" }),
  createSearchItem({ id: "item-1", label: "Second Item" }),
  createSearchItem({ id: "item-2", label: "Third Item" }),
  createSearchItem({ id: "item-3", label: "Fourth Item" }),
];

// ============================================================================
// Tests
// ============================================================================

describe("useListNavigation", () => {
  it("ArrowDown increments selectedIndex", () => {
    const onSelect = vi.fn();
    const onConfirm = vi.fn();

    const { result } = renderHook(() =>
      useListNavigation({
        flatItems: mockItems,
        selectedIndex: 0,
        onSelect,
        onConfirm,
      })
    );

    result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));

    expect(onSelect).toHaveBeenCalledWith(1, "item-1");
  });

  it("ArrowUp decrements selectedIndex", () => {
    const onSelect = vi.fn();
    const onConfirm = vi.fn();

    const { result } = renderHook(() =>
      useListNavigation({
        flatItems: mockItems,
        selectedIndex: 2,
        onSelect,
        onConfirm,
      })
    );

    result.current.handleKeyDown(createKeyboardEvent("ArrowUp"));

    expect(onSelect).toHaveBeenCalledWith(1, "item-1");
  });

  it("ArrowDown clamps at last item", () => {
    const onSelect = vi.fn();
    const onConfirm = vi.fn();

    const { result } = renderHook(() =>
      useListNavigation({
        flatItems: mockItems,
        selectedIndex: 3, // last index
        onSelect,
        onConfirm,
      })
    );

    result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));

    // Should stay at index 3
    expect(onSelect).toHaveBeenCalledWith(3, "item-3");
  });

  it("ArrowUp clamps at 0", () => {
    const onSelect = vi.fn();
    const onConfirm = vi.fn();

    const { result } = renderHook(() =>
      useListNavigation({
        flatItems: mockItems,
        selectedIndex: 0,
        onSelect,
        onConfirm,
      })
    );

    result.current.handleKeyDown(createKeyboardEvent("ArrowUp"));

    // Should stay at index 0
    expect(onSelect).toHaveBeenCalledWith(0, "item-0");
  });

  it("Enter calls onConfirm with current item", () => {
    const onSelect = vi.fn();
    const onConfirm = vi.fn();

    const { result } = renderHook(() =>
      useListNavigation({
        flatItems: mockItems,
        selectedIndex: 2,
        onSelect,
        onConfirm,
      })
    );

    result.current.handleKeyDown(createKeyboardEvent("Enter"));

    expect(onConfirm).toHaveBeenCalledWith(mockItems[2]);
  });

  it("Escape calls onEscape", () => {
    const onSelect = vi.fn();
    const onConfirm = vi.fn();
    const onEscape = vi.fn();

    const { result } = renderHook(() =>
      useListNavigation({
        flatItems: mockItems,
        selectedIndex: 0,
        onSelect,
        onConfirm,
        onEscape,
      })
    );

    result.current.handleKeyDown(createKeyboardEvent("Escape"));

    expect(onEscape).toHaveBeenCalled();
  });

  it("Tab calls onTabToggle", () => {
    const onSelect = vi.fn();
    const onConfirm = vi.fn();
    const onTabToggle = vi.fn();

    const { result } = renderHook(() =>
      useListNavigation({
        flatItems: mockItems,
        selectedIndex: 0,
        onSelect,
        onConfirm,
        onTabToggle,
      })
    );

    result.current.handleKeyDown(createKeyboardEvent("Tab"));

    expect(onTabToggle).toHaveBeenCalled();
  });

  it("Home jumps to index 0", () => {
    const onSelect = vi.fn();
    const onConfirm = vi.fn();

    const { result } = renderHook(() =>
      useListNavigation({
        flatItems: mockItems,
        selectedIndex: 3,
        onSelect,
        onConfirm,
      })
    );

    result.current.handleKeyDown(createKeyboardEvent("Home"));

    expect(onSelect).toHaveBeenCalledWith(0, "item-0");
  });

  it("End jumps to last index", () => {
    const onSelect = vi.fn();
    const onConfirm = vi.fn();

    const { result } = renderHook(() =>
      useListNavigation({
        flatItems: mockItems,
        selectedIndex: 0,
        onSelect,
        onConfirm,
      })
    );

    result.current.handleKeyDown(createKeyboardEvent("End"));

    expect(onSelect).toHaveBeenCalledWith(3, "item-3");
  });

  it("does nothing for unrecognized keys", () => {
    const onSelect = vi.fn();
    const onConfirm = vi.fn();
    const onEscape = vi.fn();

    const { result } = renderHook(() =>
      useListNavigation({
        flatItems: mockItems,
        selectedIndex: 0,
        onSelect,
        onConfirm,
        onEscape,
      })
    );

    result.current.handleKeyDown(createKeyboardEvent("a"));

    expect(onSelect).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onEscape).not.toHaveBeenCalled();
  });

  it("ignores non-Escape keys when flatItems is empty", () => {
    const onSelect = vi.fn();
    const onConfirm = vi.fn();

    const { result } = renderHook(() =>
      useListNavigation({
        flatItems: [],
        selectedIndex: 0,
        onSelect,
        onConfirm,
      })
    );

    result.current.handleKeyDown(createKeyboardEvent("ArrowDown"));
    result.current.handleKeyDown(createKeyboardEvent("Enter"));

    expect(onSelect).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("Escape still works when flatItems is empty", () => {
    const onSelect = vi.fn();
    const onConfirm = vi.fn();
    const onEscape = vi.fn();

    const { result } = renderHook(() =>
      useListNavigation({
        flatItems: [],
        selectedIndex: 0,
        onSelect,
        onConfirm,
        onEscape,
      })
    );

    result.current.handleKeyDown(createKeyboardEvent("Escape"));

    expect(onEscape).toHaveBeenCalled();
  });

  it("preventDefault is called for handled keys", () => {
    const onSelect = vi.fn();
    const onConfirm = vi.fn();

    const { result } = renderHook(() =>
      useListNavigation({
        flatItems: mockItems,
        selectedIndex: 0,
        onSelect,
        onConfirm,
      })
    );

    const event = createKeyboardEvent("ArrowDown");
    result.current.handleKeyDown(event);

    expect(event.preventDefault).toHaveBeenCalled();
  });
});
