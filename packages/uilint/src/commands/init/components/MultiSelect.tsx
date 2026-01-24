/**
 * Configuration item for the installer dashboard
 */

import React, { useState, useCallback } from "react";
import { Box, Text, useInput, useApp } from "ink";

export type ItemStatus =
  | "installed"
  | "not_installed"
  | "selected"
  | "partial"
  | "upgradeable"
  | "remove";

export interface ConfigItem {
  /** Unique ID */
  id: string;
  /** Display label */
  label: string;
  /** Optional description/hint */
  hint?: string;
  /** Current installation status */
  status: ItemStatus;
  /** Category/group this item belongs to */
  category: string;
  /** Icon for the category */
  categoryIcon?: string;
  /** Whether this item can be toggled */
  disabled?: boolean;
}

export interface ConfigSelectorProps {
  items: ConfigItem[];
  onSubmit: (selectedIds: string[], uninstallIds: string[]) => void;
  onCancel?: () => void;
}

function StatusIndicator({ status, isSelected, isMarkedForRemoval }: { status: ItemStatus; isSelected: boolean; isMarkedForRemoval: boolean }): React.ReactElement {
  // Show red X if item is marked for removal
  if (isMarkedForRemoval) {
    return <Text color="red">✗</Text>;
  }
  if (status === "installed") {
    return <Text color="green">✓</Text>;
  }
  if (status === "upgradeable") {
    // Upgradeable: show blue up arrow if selected, green check if not
    return isSelected ? <Text color="blue">⬆</Text> : <Text color="green">✓</Text>;
  }
  if (isSelected || status === "selected") {
    return <Text color="cyan">◉</Text>;
  }
  if (status === "partial") {
    return <Text color="yellow">◐</Text>;
  }
  return <Text dimColor>○</Text>;
}

function StatusLabel({ status, isMarkedForRemoval }: { status: ItemStatus; isMarkedForRemoval: boolean }): React.ReactElement {
  if (isMarkedForRemoval) {
    return <Text color="red" dimColor>remove</Text>;
  }
  if (status === "installed") {
    return <Text color="green" dimColor>installed</Text>;
  }
  if (status === "upgradeable") {
    return <Text color="blue" dimColor>upgrade available</Text>;
  }
  if (status === "partial") {
    return <Text color="yellow" dimColor>partial</Text>;
  }
  return <Text dimColor>-</Text>;
}

export function ConfigSelector({
  items,
  onSubmit,
  onCancel,
}: ConfigSelectorProps): React.ReactElement {
  const { exit } = useApp();
  const [cursor, setCursor] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(() => {
    // Pre-select items that aren't fully installed (including upgradeable)
    return new Set(
      items
        .filter((item) => item.status !== "installed" && !item.disabled)
        .map((item) => item.id)
    );
  });
  // Track installed items that are marked for removal
  const [markedForRemoval, setMarkedForRemoval] = useState<Set<string>>(new Set());

  // Group items by category
  const categories = Array.from(new Set(items.map((item) => item.category)));
  const itemsByCategory = new Map<string, ConfigItem[]>();
  for (const cat of categories) {
    itemsByCategory.set(cat, items.filter((item) => item.category === cat));
  }

  // Flatten for navigation
  const flatItems = items;

  const handleToggle = useCallback(() => {
    const item = flatItems[cursor];
    if (!item || item.disabled) return;

    // Handle installed items - toggle them for removal
    if (item.status === "installed") {
      setMarkedForRemoval((prev) => {
        const next = new Set(prev);
        if (next.has(item.id)) {
          next.delete(item.id);
        } else {
          next.add(item.id);
        }
        return next;
      });
      return;
    }

    // Handle non-installed items (including upgradeable, partial, not_installed)
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });
  }, [cursor, flatItems]);

  useInput((input, key) => {
    if (key.upArrow) {
      setCursor((prev) => (prev > 0 ? prev - 1 : flatItems.length - 1));
    } else if (key.downArrow) {
      setCursor((prev) => (prev < flatItems.length - 1 ? prev + 1 : 0));
    } else if (input === " ") {
      handleToggle();
    } else if (key.return) {
      onSubmit(Array.from(selected), Array.from(markedForRemoval));
    } else if (input === "q" || key.escape) {
      onCancel?.();
      exit();
    } else if (input === "a") {
      // Select all non-installed and upgradeable
      setSelected(
        new Set(
          items
            .filter((item) => item.status !== "installed" && !item.disabled)
            .map((item) => item.id)
        )
      );
      // Clear removal selections
      setMarkedForRemoval(new Set());
    } else if (input === "n") {
      // Select none
      setSelected(new Set());
      // Clear removal selections too
      setMarkedForRemoval(new Set());
    }
  });

  let globalIndex = 0;

  return (
    <Box flexDirection="column">
      {categories.map((category) => {
        const categoryItems = itemsByCategory.get(category) || [];
        const categoryIcon = categoryItems[0]?.categoryIcon || "•";

        return (
          <Box key={category} flexDirection="column" marginBottom={1}>
            {/* Category header */}
            <Box>
              <Text bold color="white">
                {categoryIcon} {category}
              </Text>
            </Box>

            {/* Category items */}
            {categoryItems.map((item) => {
              const itemIndex = globalIndex++;
              const isCursor = itemIndex === cursor;
              const isItemSelected = selected.has(item.id);
              const isItemMarkedForRemoval = markedForRemoval.has(item.id);
              // Items are only disabled if explicitly marked as such
              const isDisabled = item.disabled === true;

              return (
                <Box key={item.id} paddingLeft={2}>
                  {/* Cursor indicator */}
                  <Text color={isCursor ? "cyan" : undefined}>
                    {isCursor ? "› " : "  "}
                  </Text>

                  {/* Status checkbox */}
                  <Box width={2}>
                    <StatusIndicator status={item.status} isSelected={isItemSelected} isMarkedForRemoval={isItemMarkedForRemoval} />
                  </Box>

                  {/* Label */}
                  <Box width={28}>
                    <Text
                      color={isItemMarkedForRemoval ? "red" : isDisabled ? undefined : isCursor ? "cyan" : undefined}
                      dimColor={isDisabled && !isItemMarkedForRemoval}
                    >
                      {item.label}
                    </Text>
                  </Box>

                  {/* Hint */}
                  <Box width={20}>
                    <Text dimColor>{item.hint || ""}</Text>
                  </Box>

                  {/* Status */}
                  <StatusLabel status={item.status} isMarkedForRemoval={isItemMarkedForRemoval} />
                </Box>
              );
            })}
          </Box>
        );
      })}

      {/* Footer with keyboard hints */}
      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text dimColor>
          <Text color="cyan">↑↓</Text> navigate{"  "}
          <Text color="cyan">space</Text> toggle{"  "}
          <Text color="cyan">a</Text> all{"  "}
          <Text color="cyan">n</Text> none{"  "}
          <Text color="cyan">enter</Text> apply{"  "}
          <Text color="cyan">q</Text> quit
        </Text>
      </Box>

      {/* Selection summary */}
      <Box marginTop={1}>
        <Text>
          <Text color="cyan">{selected.size}</Text>
          <Text dimColor> to install</Text>
          {markedForRemoval.size > 0 && (
            <>
              <Text dimColor>, </Text>
              <Text color="red">{markedForRemoval.size}</Text>
              <Text dimColor> to remove</Text>
            </>
          )}
        </Text>
      </Box>
    </Box>
  );
}
