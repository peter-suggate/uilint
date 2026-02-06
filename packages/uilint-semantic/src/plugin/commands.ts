/**
 * Semantic Plugin Commands
 *
 * Command palette commands for the semantic plugin.
 * Declarative - no React.
 */

import type { CommandDefinition } from "uilint-core";

/**
 * Semantic plugin commands
 */
export const semanticCommands: CommandDefinition[] = [
  {
    id: "semantic:rebuild-index",
    title: "Rebuild Duplicates Index",
    keywords: ["semantic", "duplicates", "index", "rebuild", "scan"],
    category: "Semantic",
    subtitle: "Rebuild the semantic code index for duplicate detection",
    icon: "refresh",
    action: { type: "start-indexing" },
  },
  {
    id: "semantic:clear-filter",
    title: "Clear Duplicate Filter",
    keywords: ["semantic", "duplicates", "clear", "filter", "heatmap"],
    category: "Semantic",
    subtitle: "Clear the heatmap filter for duplicates",
    icon: "x",
    action: { type: "clear-heatmap-filter" },
  },
];
