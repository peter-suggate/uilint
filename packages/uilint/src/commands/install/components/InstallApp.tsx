/**
 * InstallApp - Main Ink React component for the installer UI
 *
 * A beautiful configuration dashboard that shows:
 * - All available features grouped by category
 * - Current installation status
 * - Interactive toggle selection
 * - Progress during installation
 */

import React, { useState, useEffect } from "react";
import { Box, Text, useApp } from "ink";
import { Spinner } from "./Spinner.js";
import { ConfigSelector, type ConfigItem } from "./MultiSelect.js";
import { ProgressList, progressEventsToTasks } from "./ProgressList.js";
import type { ProjectState } from "../types.js";
import type { InstallerSelection, ProgressEvent } from "../installers/types.js";
import { getAllInstallers } from "../installers/registry.js";

type AppState = "scanning" | "configuring" | "executing" | "complete" | "error";

export interface InstallAppProps {
  /** Project scan promise (resolves to ProjectState) */
  projectPromise: Promise<ProjectState>;
  /** Callback when installation is complete */
  onComplete: (selections: InstallerSelection[]) => void;
  /** Callback when error occurs */
  onError?: (error: Error) => void;
}

/**
 * Convert installer selections to ConfigItems for the dashboard
 */
function buildConfigItems(
  project: ProjectState,
  selections: InstallerSelection[]
): ConfigItem[] {
  const items: ConfigItem[] = [];

  for (const selection of selections) {
    const { installer, targets } = selection;

    // Map installer IDs to categories
    const categoryMap: Record<string, { name: string; icon: string }> = {
      genstyleguide: { name: "Commands", icon: "📝" },
      skill: { name: "Agent Skills", icon: "⚡" },
      next: { name: "UI Overlay", icon: "🔷" },
      vite: { name: "UI Overlay", icon: "⚡" },
      eslint: { name: "ESLint Plugin", icon: "🔍" },
    };

    const category = categoryMap[installer.id] || { name: "Other", icon: "•" };

    for (const target of targets) {
      items.push({
        id: `${installer.id}:${target.id}`,
        label: target.label,
        hint: target.hint,
        status: target.isInstalled ? "installed" : "not_installed",
        category: category.name,
        categoryIcon: category.icon,
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
 * Project context bar showing detected environment
 */
function ProjectContext({ project }: { project: ProjectState }): React.ReactElement {
  const parts: string[] = [];

  // Package manager
  parts.push(project.packageManager);

  // Framework detection
  if (project.nextApps.length > 0) {
    parts.push(`${project.nextApps.length} Next.js app${project.nextApps.length > 1 ? "s" : ""}`);
  }
  if (project.viteApps.length > 0) {
    parts.push(`${project.viteApps.length} Vite app${project.viteApps.length > 1 ? "s" : ""}`);
  }

  // ESLint configs
  const eslintCount = project.packages.filter((p) => p.eslintConfigPath).length;
  if (eslintCount > 0) {
    parts.push(`${eslintCount} ESLint config${eslintCount > 1 ? "s" : ""}`);
  }

  return (
    <Box marginBottom={1}>
      <Text dimColor>
        Detected: {parts.join(" · ")}
      </Text>
    </Box>
  );
}

export function InstallApp({
  projectPromise,
  onComplete,
  onError,
}: InstallAppProps): React.ReactElement {
  const { exit } = useApp();
  const [state, setState] = useState<AppState>("scanning");
  const [project, setProject] = useState<ProjectState | null>(null);
  const [selections, setSelections] = useState<InstallerSelection[]>([]);
  const [configItems, setConfigItems] = useState<ConfigItem[]>([]);
  const [progressEvents] = useState<ProgressEvent[]>([]);
  const [error, setError] = useState<Error | null>(null);

  // Phase 1: Scan project and build selections
  useEffect(() => {
    if (state !== "scanning") return;

    projectPromise
      .then((proj) => {
        setProject(proj);

        // Build installer selections
        const installers = getAllInstallers();
        const initialSelections: InstallerSelection[] = installers
          .filter((installer) => installer.isApplicable(proj))
          .map((installer) => {
            const targets = installer.getTargets(proj);
            const nonInstalledTargets = targets.filter((t) => !t.isInstalled);
            return {
              installer,
              targets,
              selected: nonInstalledTargets.length > 0,
            };
          });

        setSelections(initialSelections);

        // Build config items for the dashboard
        const items = buildConfigItems(proj, initialSelections);
        setConfigItems(items);

        // Transition to configuring
        setState("configuring");
      })
      .catch((err) => {
        setError(err as Error);
        setState("error");
        onError?.(err as Error);
      });
  }, [state, projectPromise, onError]);

  // Handle configuration submission
  const handleConfigSubmit = (selectedIds: string[]) => {
    // Convert selected IDs back to InstallerSelections
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
    onComplete(updatedSelections);
  };

  const handleCancel = () => {
    exit();
  };

  // Render: Scanning
  if (state === "scanning") {
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
  if (state === "error") {
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

  // Render: Configuration dashboard
  if (state === "configuring" && project && configItems.length > 0) {
    return (
      <Box flexDirection="column">
        <Header subtitle="Configuration" />
        <ProjectContext project={project} />
        <ConfigSelector
          items={configItems}
          onSubmit={handleConfigSubmit}
          onCancel={handleCancel}
        />
      </Box>
    );
  }

  // Render: Executing
  if (state === "executing") {
    const tasks = progressEventsToTasks(progressEvents);
    return (
      <Box flexDirection="column">
        <Header subtitle="Installing" />
        <ProgressList tasks={tasks} />
      </Box>
    );
  }

  // Render: Complete
  if (state === "complete") {
    return (
      <Box flexDirection="column">
        <Header />
        <Box>
          <Text color="green">✓ </Text>
          <Text>Configuration applied successfully!</Text>
        </Box>
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
