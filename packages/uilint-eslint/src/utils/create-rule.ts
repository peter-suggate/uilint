/**
 * Rule creation helper using @typescript-eslint/utils
 */

import { ESLintUtils } from "@typescript-eslint/utils";

export const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/peter-suggate/uilint/blob/main/packages/uilint-eslint/docs/rules/${name}.md`
);
