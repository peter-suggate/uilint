/**
 * Auto-registration of uilint-duplicates ESLint rules.
 *
 * Importing this module registers the duplicates ESLint rules with the
 * uilint-eslint rule registry. This is called by the CLI when the
 * duplicates plugin is installed.
 */

import { registerRuleMeta, registerESLintRule, registerCategory } from "uilint-eslint";
import { noDuplicatesMeta } from "./index.js";
import noDuplicatesRule from "./no-duplicates.js";

// Register the duplicates category
registerCategory({
  id: "duplicates",
  name: "Duplicate Detection",
  description: "Embedding-based code similarity detection",
  icon: "📋",
  defaultEnabled: false,
});

// Register rule metadata and implementation
registerRuleMeta(noDuplicatesMeta);
registerESLintRule("no-duplicates", noDuplicatesRule);
