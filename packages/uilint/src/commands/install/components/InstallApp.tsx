/**
 * InstallApp - Main Ink React component for the installer UI
 *
 * Three-phase installation flow:
 * 1. Select a project (Next.js app, Vite app, etc.)
 * 2. Select features to install
 * 3. Configure ESLint rules (if ESLint selected)
 */

import React, { useState, useEffect } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { Spinner } from "./Spinner.js";
import { ProjectSelector, getDetectedProjects, type DetectedProject } from "./ProjectSelector.js";
import { ConfigSelector, type ConfigItem, type ItemStatus } from "./MultiSelect.js";
import { RuleSelector, type ConfiguredRule } from "./RuleSelector.js";
import type { ProjectState } from "../types.js";
import type { InstallerSelection, InstallTarget } from "../installers/types.js";
import { getAllInstallers } from "../installers/registry.js";

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
  | "scanning"
  | "select-project"
  | "configure-features"
  | "configure-eslint"
  | "error";

export interface InstallAppProps {
  /** Project scan promise (resolves to ProjectState) */
  projectPromise: Promise<ProjectState>;
  /** Callback when installation is complete */
  onComplete: (selections: InstallerSelection[], eslintRules?: ConfiguredRule[]) => void;
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
  onSubmit: (selectedIds: string[]) => void;
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
  const [phase, setPhase] = useState<AppPhase>("scanning");
  const [project, setProject] = useState<ProjectState | null>(null);
  const [detectedProjects, setDetectedProjects] = useState<DetectedProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<DetectedProject | null>(null);
  const [selections, setSelections] = useState<InstallerSelection[]>([]);
  const [configItems, setConfigItems] = useState<ConfigItem[]>([]);
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<string[]>([]);
  const [error, setError] = useState<Error | null>(null);

  // Check if ESLint is selected
  const isEslintSelected = selectedFeatureIds.some((id) => id.startsWith("eslint:"));

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
  const handleFeatureSubmit = (selectedIds: string[]) => {
    setSelectedFeatureIds(selectedIds);

    // Check if ESLint is selected - if so, go to rule configuration
    const eslintSelected = selectedIds.some((id) => id.startsWith("eslint:"));

    if (eslintSelected) {
      setPhase("configure-eslint");
    } else {
      // No ESLint, complete with current selections
      finishInstallation(selectedIds, undefined);
    }
  };

  // Handle ESLint rule configuration submission
  const handleRuleSubmit = (configuredRules: ConfiguredRule[]) => {
    finishInstallation(selectedFeatureIds, configuredRules);
  };

  // Handle back from ESLint config to feature selection
  const handleBackToFeatures = () => {
    setPhase("configure-features");
  };

  // Finalize installation with all selections
  const finishInstallation = (selectedIds: string[], eslintRules?: ConfiguredRule[]) => {
    const selectedSet = new Set(selectedIds);

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

    setSelections(updatedSelections);
    onComplete(updatedSelections, eslintRules);
  };

  const handleCancel = () => {
    exit();
  };

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
