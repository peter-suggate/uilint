/**
 * Install command - modular entry point
 *
 * Re-exports all install functionality for external use.
 */

export * from "./types.js";
export * from "./constants.js";
export { analyze } from "./analyze.js";
export { createPlan, getMissingRules } from "./plan.js";
export { execute } from "./execute.js";
export { cliPrompter, gatherChoices, type Prompter } from "./prompter.js";
