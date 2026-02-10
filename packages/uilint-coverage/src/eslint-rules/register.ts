import { registerRuleMeta, registerESLintRule, registerCategory } from "uilint-eslint";
import { requireTestCoverageMeta } from "./index.js";
import requireTestCoverageRule from "./require-test-coverage/index.js";

registerCategory({
  id: "coverage",
  name: "Test Coverage",
  description: "Test coverage analysis and enforcement",
  icon: "🧪",
  defaultEnabled: true,
});

registerRuleMeta(requireTestCoverageMeta);
registerESLintRule("require-test-coverage", requireTestCoverageRule);
