/**
 * Mock prompter for testing
 *
 * Provides a way to create mock Prompter implementations that return
 * canned responses for testing the install command.
 */

import type { RuleMetadata } from "uilint-eslint";
import { ruleRegistry } from "uilint-eslint";
import type {
  InstallItem,
  NextAppInfo,
  ViteAppInfo,
  EslintPackageInfo,
} from "../../src/commands/install/types.js";
import type { Prompter } from "../../src/commands/install/prompter.js";

export interface MockPrompterOptions {
  /** Items to select for installation */
  installItems?: InstallItem[];
  /** Whether to merge MCP config */
  mcpMerge?: boolean;
  /** Whether to merge hooks config */
  hooksMerge?: boolean;
  /** Index of Next.js app to select (when multiple found) */
  nextAppIndex?: number;
  /** Index of Vite app to select (when multiple found) */
  viteAppIndex?: number;
  /** Package paths to select for ESLint installation */
  eslintPackagePaths?: string[];
  /** Rule IDs to select for ESLint */
  eslintRuleIds?: string[];
  /** Severity choice for selected rules */
  eslintRuleSeverity?: "warn" | "error" | "defaults";
  /** Whether to customize individual rule options (default: false - use defaults) */
  customizeRuleOptions?: boolean;
  /** Custom rule options by rule ID */
  ruleOptions?: Record<string, Record<string, unknown>>;
}

/**
 * Create a mock prompter that returns canned responses
 *
 * @param options - Configuration for mock responses
 * @returns Prompter implementation for testing
 */
export function mockPrompter(options: MockPrompterOptions = {}): Prompter {
  const {
    installItems = ["mcp", "hooks"],
    mcpMerge = true,
    hooksMerge = true,
    nextAppIndex = 0,
    viteAppIndex = 0,
    eslintPackagePaths,
    eslintRuleIds,
    eslintRuleSeverity = "warn",
    customizeRuleOptions = false,
    ruleOptions = {},
  } = options;

  return {
    async selectInstallItems(): Promise<InstallItem[]> {
      return installItems;
    },

    async confirmMcpMerge(): Promise<boolean> {
      return mcpMerge;
    },

    async confirmHooksMerge(): Promise<boolean> {
      return hooksMerge;
    },

    async selectNextApp(apps: NextAppInfo[]): Promise<NextAppInfo> {
      return apps[nextAppIndex] || apps[0];
    },

    async selectViteApp(apps: ViteAppInfo[]): Promise<ViteAppInfo> {
      return apps[viteAppIndex] || apps[0];
    },

    async selectEslintPackages(
      packages: EslintPackageInfo[]
    ): Promise<string[]> {
      if (eslintPackagePaths) {
        return eslintPackagePaths;
      }
      // Default: select all packages with ESLint config
      return packages
        .filter((p) => p.eslintConfigPath !== null)
        .map((p) => p.path);
    },

    async selectEslintRules(): Promise<RuleMetadata[]> {
      if (eslintRuleIds) {
        return ruleRegistry.filter((r) => eslintRuleIds.includes(r.id));
      }
      // Default: select all static rules
      return ruleRegistry.filter((r) => r.category === "static");
    },

    async selectEslintRuleSeverity(): Promise<"warn" | "error" | "defaults"> {
      return eslintRuleSeverity;
    },

    async confirmCustomizeRuleOptions(): Promise<boolean> {
      return customizeRuleOptions;
    },

    async configureRuleOptions(
      rule: RuleMetadata
    ): Promise<Record<string, unknown> | undefined> {
      // Return custom options if provided, otherwise use defaults from registry
      if (ruleOptions[rule.id]) {
        return ruleOptions[rule.id];
      }
      // If no custom options and rule has schema, return undefined to use defaults
      if (rule.optionSchema && rule.optionSchema.fields.length > 0) {
        return undefined;
      }
      return undefined;
    },
  };
}

/**
 * Create a prompter that throws on any interaction
 * (useful for testing non-interactive mode)
 */
export function noopPrompter(): Prompter {
  const throwError = () => {
    throw new Error("Prompter should not be called in non-interactive mode");
  };

  return {
    selectInstallItems: throwError,
    confirmMcpMerge: throwError,
    confirmHooksMerge: throwError,
    selectNextApp: throwError,
    selectViteApp: throwError,
    selectEslintPackages: throwError,
    selectEslintRules: throwError,
    selectEslintRuleSeverity: throwError,
    confirmCustomizeRuleOptions: throwError,
    configureRuleOptions: throwError,
  };
}

/**
 * Create a prompter that accepts everything with defaults
 */
export function acceptAllPrompter(): Prompter {
  return mockPrompter({
    installItems: ["mcp", "hooks", "genstyleguide", "genrules", "eslint"],
    mcpMerge: true,
    hooksMerge: true,
    customizeRuleOptions: false,
  });
}
