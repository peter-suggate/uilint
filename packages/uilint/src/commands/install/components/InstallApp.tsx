/**
 * InstallApp - Main Ink React component for the installer UI
 *
 * Multi-phase installation flow:
 * 1. Select a project (Next.js app, Vite app, etc.)
 * 2. Select features to install
 * 3. Configure injection point (if Next.js/Vite overlay selected with multiple options)
 * 4. Configure ESLint rules (if ESLint selected)
 */

import React, { useState, useEffect } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { Spinner } from "./Spinner.js";
import { ProjectSelector, getDetectedProjects, type DetectedProject } from "./ProjectSelector.js";
import { ConfigSelector, type ConfigItem, type ItemStatus } from "./MultiSelect.js";
import { RuleSelector, type ConfiguredRule } from "./RuleSelector.js";
import { InjectionPointSelector } from "./InjectionPointSelector.js";
import type { ProjectState } from "../types.js";
import type { InstallerSelection, InstallTarget } from "../installers/types.js";
import { getAllInstallers } from "../installers/registry.js";
import { getInjectionPoints, type InjectionPoint } from "../installers/next-overlay.js";

/**
 * Map InstallTarget to ConfigItem status
 */
function getTargetStatus(target: InstallTarget): ItemStatus {
  if (!target.isInstalled) {
    return "not_installed";
  }
  if (target.canUpgrade) {
    return "upgradeable";
  }
  return "installed";
}

type AppPhase =
  | "checking-requirements"
  | "scanning"
  | "select-project"
  | "configure-features"
  | "configure-injection-point"
  | "configure-eslint"
  | "error";

/**
 * Selected injection point config to pass to installer
 */
export interface InjectionPointConfig {
  targetFile?: string;
  createProviders?: boolean;
}

export interface InstallAppProps {
  /** Project scan promise (resolves to ProjectState) */
  projectPromise: Promise<ProjectState>;
  /** Callback when installation is complete */
  onComplete: (
    selections: InstallerSelection[],
    eslintRules?: ConfiguredRule[],
    injectionPointConfig?: InjectionPointConfig,
    uninstallSelections?: InstallerSelection[]
  ) => void;
  /** Callback when error occurs */
  onError?: (error: Error) => void;
}

/**
 * Build config items for a specific project
 */
function buildConfigItemsForProject(
  project: ProjectState,
  selectedProject: DetectedProject,
  selections: InstallerSelection[]
): ConfigItem[] {
  const items: ConfigItem[] = [];

  for (const selection of selections) {
    const { installer, targets } = selection;

    // Filter targets to those relevant to the selected project
    const relevantTargets = targets.filter((target) => {
      // For overlay installers, match by path
      if (installer.id === "next" || installer.id === "vite") {
        return target.path === selectedProject.path;
      }
      // For ESLint, match by package path
      if (installer.id === "eslint") {
        return target.path === selectedProject.path;
      }
      // Global features (genstyleguide, skill) always included
      return true;
    });

    if (relevantTargets.length === 0) continue;

    // Map installer IDs to display info
    const displayInfo: Record<string, { category: string; icon: string }> = {
      next: { category: "UI Analysis", icon: "🔍" },
      vite: { category: "UI Analysis", icon: "🔍" },
      eslint: { category: "ESLint Rules", icon: "📋" },
      genstyleguide: { category: "Cursor Integration", icon: "📝" },
      skill: { category: "Cursor Integration", icon: "⚡" },
    };

    const info = displayInfo[installer.id] || { category: "Other", icon: "•" };

    for (const target of relevantTargets) {
      items.push({
        id: `${installer.id}:${target.id}`,
        label: installer.name,
        hint: target.hint,
        status: getTargetStatus(target),
        category: info.category,
        categoryIcon: info.icon,
      });
    }
  }

  return items;
}

/**
 * Build config items for global features only (no project-specific items)
 */
function buildGlobalConfigItems(selections: InstallerSelection[]): ConfigItem[] {
  const items: ConfigItem[] = [];

  for (const selection of selections) {
    const { installer, targets } = selection;

    // Only include global installers
    if (installer.id !== "genstyleguide" && installer.id !== "skill") {
      continue;
    }

    const displayInfo: Record<string, { category: string; icon: string }> = {
      genstyleguide: { category: "Cursor Integration", icon: "📝" },
      skill: { category: "Cursor Integration", icon: "⚡" },
    };

    const info = displayInfo[installer.id] || { category: "Other", icon: "•" };

    for (const target of targets) {
      items.push({
        id: `${installer.id}:${target.id}`,
        label: installer.name,
        hint: target.hint,
        status: getTargetStatus(target),
        category: info.category,
        categoryIcon: info.icon,
      });
    }
  }

  return items;
}

/**
 * Minimum required Node.js version
 */
const MIN_NODE_VERSION = 20;

/**
 * Check if the current Node.js version meets the minimum requirement
 */
function checkNodeVersion(): { ok: boolean; current: string; required: number } {
  const ver = process.versions.node || "";
  const majorStr = ver.split(".")[0] || "";
  const major = Number.parseInt(majorStr, 10);

  return {
    ok: Number.isFinite(major) && major >= MIN_NODE_VERSION,
    current: ver,
    required: MIN_NODE_VERSION,
  };
}

/**
 * Header component with app branding
 */
function Header({ subtitle }: { subtitle?: string }): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color="cyan">◆ UILint</Text>
        <Text dimColor> v0.5.0</Text>
        {subtitle && <Text dimColor> · {subtitle}</Text>}
      </Box>
    </Box>
  );
}

/**
 * Feature configuration with back support
 */
function FeatureConfig({
  selectedProject,
  configItems,
  canGoBack,
  onSubmit,
  onBack,
  onCancel,
}: {
  selectedProject: DetectedProject | null;
  configItems: ConfigItem[];
  canGoBack: boolean;
  onSubmit: (selectedIds: string[], uninstallIds: string[]) => void;
  onBack: () => void;
  onCancel: () => void;
}): React.ReactElement {
  useInput((input, key) => {
    if ((input === "b" || key.leftArrow) && canGoBack) {
      onBack();
    }
  });

  return (
    <Box flexDirection="column">
      {/* Show selected project context */}
      {selectedProject && (
        <Box marginBottom={1}>
          <Text dimColor>Project: </Text>
          <Text bold color="cyan">{selectedProject.name}</Text>
          <Text dimColor> ({selectedProject.hint})</Text>
        </Box>
      )}

      <ConfigSelector
        items={configItems}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />

      {/* Back hint if multiple projects */}
      {canGoBack && (
        <Box marginTop={1}>
          <Text dimColor>
            Press <Text color="cyan">b</Text> or <Text color="cyan">←</Text> to select a different project
          </Text>
        </Box>
      )}
    </Box>
  );
}

export function InstallApp({
  projectPromise,
  onComplete,
  onError,
}: InstallAppProps): React.ReactElement {
  const { exit } = useApp();
  const [phase, setPhase] = useState<AppPhase>("checking-requirements");
  const [nodeVersionCheck, setNodeVersionCheck] = useState<{
    ok: boolean;
    current: string;
    required: number;
  } | null>(null);
  const [project, setProject] = useState<ProjectState | null>(null);
  const [detectedProjects, setDetectedProjects] = useState<DetectedProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<DetectedProject | null>(null);
  const [selections, setSelections] = useState<InstallerSelection[]>([]);
  const [configItems, setConfigItems] = useState<ConfigItem[]>([]);
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<string[]>([]);
  const [uninstallFeatureIds, setUninstallFeatureIds] = useState<string[]>([]);
  const [error, setError] = useState<Error | null>(null);

  // Injection point state
  const [injectionPoints, setInjectionPoints] = useState<InjectionPoint[]>([]);
  const [selectedInjectionPoint, setSelectedInjectionPoint] = useState<InjectionPointConfig | undefined>(undefined);

  // Check if ESLint is selected
  const isEslintSelected = selectedFeatureIds.some((id) => id.startsWith("eslint:"));

  // Check if Next.js overlay is selected
  const isNextSelected = selectedFeatureIds.some((id) => id.startsWith("next:"));

  // Phase 0: Check requirements (Node version)
  useEffect(() => {
    if (phase !== "checking-requirements") return;

    // Small delay for visual feedback that the check is happening
    const timer = setTimeout(() => {
      const result = checkNodeVersion();
      setNodeVersionCheck(result);

      if (result.ok) {
        setPhase("scanning");
      } else {
        setError(
          new Error(
            `Node.js ${result.required}+ is required. You are running Node.js ${result.current}.`
          )
        );
        setPhase("error");
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [phase]);

  // Phase 1: Scan project
  useEffect(() => {
    if (phase !== "scanning") return;

    projectPromise
      .then((proj) => {
        setProject(proj);

        // Get detected projects
        const projects = getDetectedProjects(proj);
        setDetectedProjects(projects);

        // Build installer selections
        const installers = getAllInstallers();
        const initialSelections: InstallerSelection[] = installers
          .filter((installer) => installer.isApplicable(proj))
          .map((installer) => {
            const targets = installer.getTargets(proj);
            // Select if there are non-installed targets OR upgradeable targets
            const actionableTargets = targets.filter(
              (t) => !t.isInstalled || t.canUpgrade
            );
            return {
              installer,
              targets,
              selected: actionableTargets.length > 0,
            };
          });
        setSelections(initialSelections);

        // If only one project, skip project selection
        if (projects.length === 1) {
          const singleProject = projects[0]!;
          setSelectedProject(singleProject);
          const items = buildConfigItemsForProject(proj, singleProject, initialSelections);
          setConfigItems(items);
          setPhase("configure-features");
        } else if (projects.length === 0) {
          // No projects detected - go straight to global features
          setPhase("configure-features");
          const items = buildGlobalConfigItems(initialSelections);
          setConfigItems(items);
        } else {
          setPhase("select-project");
        }
      })
      .catch((err) => {
        setError(err as Error);
        setPhase("error");
        onError?.(err as Error);
      });
  }, [phase, projectPromise, onError]);

  // Handle project selection
  const handleProjectSelect = (selected: DetectedProject) => {
    setSelectedProject(selected);
    if (project) {
      const items = buildConfigItemsForProject(project, selected, selections);
      setConfigItems(items);
    }
    setPhase("configure-features");
  };

  // Handle back to project selection
  const handleBackToProject = () => {
    if (detectedProjects.length > 1) {
      setSelectedProject(null);
      setPhase("select-project");
    }
  };

  // Handle feature selection submission
  const handleFeatureSubmit = (selectedIds: string[], uninstallIds: string[]) => {
    setSelectedFeatureIds(selectedIds);
    setUninstallFeatureIds(uninstallIds);

    // Check if Next.js overlay is selected - if so, check injection points
    const nextSelected = selectedIds.some((id) => id.startsWith("next:"));

    if (nextSelected && project && selectedProject) {
      // Find the Next.js app info
      const appInfo = project.nextApps.find(
        (app) => app.projectPath === selectedProject.path
      );

      if (appInfo) {
        const points = getInjectionPoints(appInfo.projectPath, appInfo.detection.appRoot);

        // If there's only one injection point, auto-select it
        if (points.length === 1) {
          const point = points[0]!;
          setSelectedInjectionPoint({
            targetFile: point.filePath,
            createProviders: point.createProviders,
          });
          // Continue to next phase
          proceedAfterInjectionPoint(selectedIds, {
            targetFile: point.filePath,
            createProviders: point.createProviders,
          });
          return;
        }

        // Multiple injection points - show selection UI
        if (points.length > 1) {
          setInjectionPoints(points);
          setPhase("configure-injection-point");
          return;
        }
      }
    }

    // No injection point selection needed, check ESLint
    proceedAfterInjectionPoint(selectedIds, undefined);
  };

  // Proceed after injection point selection (or skip)
  const proceedAfterInjectionPoint = (
    selectedIds: string[],
    injectionConfig?: InjectionPointConfig
  ) => {
    // Check if ESLint is selected - if so, go to rule configuration
    const eslintSelected = selectedIds.some((id) => id.startsWith("eslint:"));

    if (eslintSelected) {
      setPhase("configure-eslint");
    } else {
      // No ESLint, complete with current selections
      finishInstallation(selectedIds, undefined, injectionConfig);
    }
  };

  // Handle injection point selection
  const handleInjectionPointSubmit = (point: InjectionPoint) => {
    const config: InjectionPointConfig = {
      targetFile: point.filePath,
      createProviders: point.createProviders,
    };
    setSelectedInjectionPoint(config);
    proceedAfterInjectionPoint(selectedFeatureIds, config);
  };

  // Handle back from injection point selection
  const handleBackFromInjectionPoint = () => {
    setPhase("configure-features");
  };

  // Handle ESLint rule configuration submission
  const handleRuleSubmit = (configuredRules: ConfiguredRule[]) => {
    finishInstallation(selectedFeatureIds, configuredRules, selectedInjectionPoint);
  };

  // Handle back from ESLint config to feature selection
  const handleBackToFeatures = () => {
    setPhase("configure-features");
  };

  // Finalize installation with all selections
  const finishInstallation = (
    selectedIds: string[],
    eslintRules?: ConfiguredRule[],
    injectionConfig?: InjectionPointConfig
  ) => {
    const selectedSet = new Set(selectedIds);
    const uninstallSet = new Set(uninstallFeatureIds);

    // Build install selections
    const updatedSelections = selections.map((sel) => {
      const selectedTargets = sel.targets.filter((t) =>
        selectedSet.has(`${sel.installer.id}:${t.id}`)
      );
      return {
        ...sel,
        targets: selectedTargets,
        selected: selectedTargets.length > 0,
      };
    });

    // Build uninstall selections
    const uninstallSelections = selections.map((sel) => {
      const uninstallTargets = sel.targets.filter((t) =>
        uninstallSet.has(`${sel.installer.id}:${t.id}`)
      );
      return {
        ...sel,
        targets: uninstallTargets,
        selected: uninstallTargets.length > 0,
      };
    }).filter((sel) => sel.selected);

    setSelections(updatedSelections);
    onComplete(updatedSelections, eslintRules, injectionConfig, uninstallSelections.length > 0 ? uninstallSelections : undefined);
  };

  const handleCancel = () => {
    exit();
  };

  // Render: Checking requirements
  if (phase === "checking-requirements") {
    return (
      <Box flexDirection="column">
        <Header subtitle="Install" />
        <Box>
          <Spinner />
          <Text> Checking requirements...</Text>
        </Box>
      </Box>
    );
  }

  // Render: Scanning
  if (phase === "scanning") {
    return (
      <Box flexDirection="column">
        <Header subtitle="Install" />
        <Box>
          <Spinner />
          <Text> Scanning project...</Text>
        </Box>
      </Box>
    );
  }

  // Render: Error
  if (phase === "error") {
    return (
      <Box flexDirection="column">
        <Header />
        <Box>
          <Text color="red">✗ </Text>
          <Text color="red">{error?.message || "An unknown error occurred"}</Text>
        </Box>
      </Box>
    );
  }

  // Render: Project selection
  if (phase === "select-project") {
    return (
      <Box flexDirection="column">
        <Header subtitle="Install" />
        <ProjectSelector
          projects={detectedProjects}
          onSelect={handleProjectSelect}
          onCancel={handleCancel}
        />
      </Box>
    );
  }

  // Render: Feature configuration
  if (phase === "configure-features" && project && configItems.length > 0) {
    return (
      <Box flexDirection="column">
        <Header subtitle="Features" />
        <FeatureConfig
          selectedProject={selectedProject}
          configItems={configItems}
          canGoBack={detectedProjects.length > 1}
          onSubmit={handleFeatureSubmit}
          onBack={handleBackToProject}
          onCancel={handleCancel}
        />
      </Box>
    );
  }

  // Render: Injection point configuration
  if (phase === "configure-injection-point" && injectionPoints.length > 0) {
    return (
      <Box flexDirection="column">
        <Header subtitle="Injection Point" />
        {selectedProject && (
          <Box marginBottom={1}>
            <Text dimColor>Project: </Text>
            <Text bold color="cyan">{selectedProject.name}</Text>
          </Box>
        )}
        <InjectionPointSelector
          points={injectionPoints}
          onSubmit={handleInjectionPointSubmit}
          onBack={handleBackFromInjectionPoint}
          onCancel={handleCancel}
        />
      </Box>
    );
  }

  // Render: ESLint rule configuration
  if (phase === "configure-eslint") {
    return (
      <Box flexDirection="column">
        <Header subtitle="ESLint Rules" />
        {selectedProject && (
          <Box marginBottom={1}>
            <Text dimColor>Project: </Text>
            <Text bold color="cyan">{selectedProject.name}</Text>
          </Box>
        )}
        <RuleSelector
          onSubmit={handleRuleSubmit}
          onBack={handleBackToFeatures}
          onCancel={handleCancel}
        />
      </Box>
    );
  }

  // Fallback
  return (
    <Box flexDirection="column">
      <Header />
      <Text dimColor>Loading...</Text>
    </Box>
  );
}
