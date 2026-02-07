/**
 * Auto-registration of uilint-vision ESLint rules.
 *
 * Importing this module registers the vision ESLint rules with the
 * uilint-eslint rule registry. This is called by the CLI when vision
 * is installed.
 */

import { registerRuleMeta, registerESLintRule, registerCategory } from "uilint-eslint";
import { semanticVisionMeta } from "./index.js";
import semanticVisionRule from "./semantic-vision.js";

// Register the vision category
registerCategory({
  id: "vision",
  name: "Vision Rules",
  description: "AI-powered visual analysis",
  icon: "👁️",
  defaultEnabled: false,
});

// Register rule metadata and implementation
registerRuleMeta(semanticVisionMeta);
registerESLintRule("semantic-vision", semanticVisionRule);
