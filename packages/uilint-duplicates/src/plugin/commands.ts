/**
 * Duplicates Plugin Commands
 *
 * Command palette commands for the duplicates plugin.
 * Declarative - no React.
 */

import type { CommandDefinition } from "uilint-core";

/**
 * Duplicates plugin commands
 */
export const duplicatesCommands: CommandDefinition[] = [
  {
    id: "duplicates:rebuild-index",
    title: "Rebuild Duplicates Index",
    keywords: ["duplicates", "index", "rebuild", "scan", "embeddings"],
    category: "Duplicates",
    subtitle: "Rebuild the semantic code index for duplicate detection",
    icon: "refresh",
    action: { type: "start-indexing" },
  },
  {
    id: "duplicates:clear-filter",
    title: "Clear Duplicate Filter",
    keywords: ["duplicates", "clear", "filter", "heatmap"],
    category: "Duplicates",
    subtitle: "Clear the heatmap filter for duplicates",
    icon: "x",
    action: { type: "clear-heatmap-filter" },
  },
];
