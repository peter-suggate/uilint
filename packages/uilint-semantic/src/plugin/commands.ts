/**
 * Styleguide Plugin Commands
 *
 * Command palette commands for the styleguide plugin.
 * Declarative - no React.
 */

import type { CommandDefinition } from "uilint-core";

/**
 * Styleguide plugin commands
 */
export const styleguideCommands: CommandDefinition[] = [
  {
    id: "styleguide:check-status",
    title: "Check Styleguide Status",
    keywords: ["styleguide", "status", "check", "model", "ollama"],
    category: "Styleguide",
    subtitle: "Check if styleguide and LLM model are available",
    icon: "check-circle",
    action: { type: "check-styleguide-status" },
  },
  {
    id: "styleguide:reload",
    title: "Reload Styleguide",
    keywords: ["styleguide", "reload", "refresh"],
    category: "Styleguide",
    subtitle: "Reload the styleguide file from disk",
    icon: "refresh",
    action: { type: "reload-styleguide" },
  },
];
