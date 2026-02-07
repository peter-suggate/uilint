/**
 * Auto-registration of uilint-semantic ESLint rules.
 *
 * Importing this module registers the semantic ESLint rules with the
 * uilint-eslint rule registry. This is called by the CLI when semantic
 * is installed.
 */

import { registerRuleMeta, registerESLintRule, registerCategory } from "uilint-eslint";
import { semanticMeta, noSemanticDuplicatesMeta } from "./index.js";
import semanticRule from "./semantic/index.js";
import noSemanticDuplicatesRule from "./no-semantic-duplicates.js";

// Register the semantic category (idempotent — may already exist as built-in)
registerCategory({
  id: "semantic",
  name: "Semantic Rules",
  description: "LLM-powered analysis",
  icon: "🧠",
  defaultEnabled: false,
});

// Register rule metadata and implementations
registerRuleMeta(semanticMeta);
registerESLintRule("semantic", semanticRule);
registerRuleMeta(noSemanticDuplicatesMeta);
registerESLintRule("no-semantic-duplicates", noSemanticDuplicatesRule);
