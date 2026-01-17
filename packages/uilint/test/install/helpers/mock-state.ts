/**
 * Mock project state builders for testing
 */

import type {
  ProjectState,
  NextAppInfo,
  ViteAppInfo,
  EslintPackageInfo,
} from "../../../src/commands/install/types.js";

/**
 * Create a minimal mock ProjectState for testing
 */
export function createMockProjectState(
  overrides: Partial<ProjectState> = {}
): ProjectState {
  return {
    projectPath: "/test/project",
    workspaceRoot: "/test/project",
    packageManager: "pnpm",
    cursorDir: {
      exists: false,
      path: "/test/project/.cursor",
    },
    styleguide: {
      exists: false,
      path: "/test/project/.uilint/styleguide.md",
    },
    commands: {
      genstyleguide: false,
    },
    nextApps: [],
    viteApps: [],
    packages: [],
    ...overrides,
  };
}

/**
 * Create mock Next.js app info
 */
export function createMockNextApp(
  projectPath = "/test/project/apps/web"
): NextAppInfo {
  return {
    projectPath,
    detection: {
      appRoot: "app",
      appRootAbs: `${projectPath}/app`,
      candidates: ["app/layout.tsx"],
    },
  };
}

/**
 * Create mock Vite app info
 */
export function createMockViteApp(
  projectPath = "/test/project/apps/web"
): ViteAppInfo {
  return {
    projectPath,
    detection: {
      configFile: "vite.config.ts",
      configFileAbs: `${projectPath}/vite.config.ts`,
      entryRoot: "src",
      candidates: ["src/main.tsx"],
    },
  };
}

/**
 * Create mock ESLint package info
 */
export function createMockEslintPackage(
  path = "/test/project/packages/app",
  overrides: Partial<EslintPackageInfo> = {}
): EslintPackageInfo {
  return {
    name: "app",
    path,
    displayPath: path,
    hasEslintConfig: true,
    isFrontend: true,
    isRoot: false,
    isTypeScript: true,
    eslintConfigPath: `${path}/eslint.config.mjs`,
    eslintConfigFilename: "eslint.config.mjs",
    hasUilintRules: false,
    configuredRuleIds: [],
    ...overrides,
  };
}

/**
 * Create a mock project state with Next.js app
 */
export function createMockNextProjectState(): ProjectState {
  return createMockProjectState({
    nextApps: [createMockNextApp()],
    packages: [createMockEslintPackage()],
  });
}

/**
 * Create a mock project state with Vite app
 */
export function createMockViteProjectState(): ProjectState {
  return createMockProjectState({
    viteApps: [createMockViteApp()],
    packages: [createMockEslintPackage()],
  });
}

/**
 * Create a mock project state with multiple apps (monorepo)
 */
export function createMockMonorepoProjectState(): ProjectState {
  return createMockProjectState({
    nextApps: [createMockNextApp("/test/project/apps/web")],
    viteApps: [createMockViteApp("/test/project/apps/admin")],
    packages: [
      createMockEslintPackage("/test/project/apps/web"),
      createMockEslintPackage("/test/project/apps/admin"),
      createMockEslintPackage("/test/project/packages/ui"),
    ],
  });
}
