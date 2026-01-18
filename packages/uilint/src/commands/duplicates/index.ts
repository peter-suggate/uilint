/**
 * Duplicates command - semantic code duplicate detection
 */

import { Command } from "commander";
import { indexCommand } from "./index-cmd.js";
import { findCommand } from "./find.js";
import { searchCommand } from "./search.js";
import { similarCommand } from "./similar.js";

export function createDuplicatesCommand(): Command {
  const duplicates = new Command("duplicates")
    .description("Semantic code duplicate detection");

  // Add subcommands
  duplicates.addCommand(indexCommand());
  duplicates.addCommand(findCommand());
  duplicates.addCommand(searchCommand());
  duplicates.addCommand(similarCommand());

  return duplicates;
}
