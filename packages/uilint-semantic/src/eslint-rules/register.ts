/**
 * Auto-registration of uilint-semantic ESLint rules.
 *
 * Importing this module registers the semantic ESLint rule (styleguide checking)
 * with the uilint-eslint rule registry. This is called by the CLI when
 * uilint-semantic is installed.
 */

import { registerRuleMeta, registerESLintRule, registerCategory } from "uilint-eslint";
import { semanticMeta } from "./index.js";
import semanticRule from "./semantic/index.js";

// Register the styleguide category
registerCategory({
  id: "styleguide",
  name: "Styleguide Rules",
  description: "LLM-powered styleguide enforcement",
  icon: "📖",
  defaultEnabled: false,
});

// Register rule metadata and implementation
registerRuleMeta(semanticMeta);
registerESLintRule("semantic", semanticRule);
