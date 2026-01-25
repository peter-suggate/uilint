/**
 * RemoveApp - Ink React component for the remove UI
 *
 * Simplified flow for removing UILint components:
 * 1. Loading (analyze project)
 * 2. Project selection (if multiple projects have installed components)
 * 3. Selection (show installed items with checkboxes)
 * 4. Confirmation (preview what will be removed)
 * 5. Executing (progress indicator)
 */

import React, { useState, useEffect } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { Spinner } from "../../init/components/Spinner.js";
import type { ProjectState } from "../../init/types.js";
import type { InstallerSelection, InstallTarget, Installer } from "../../init/installers/types.js";
import { getAllInstallers } from "../../init/installers/registry.js";

type RemovePhase = "loading" | "select-project" | "select" | "confirm" | "executing" | "done" | "error";

/**
 * Detected project with installed components
 */
interface ProjectWithInstalls {
  /** Unique ID */
  id: string;
  /** Project name/label (relative path) */
  name: string;
  /** Project path (absolute) */
  path: string;
  /** Framework type */
  type: "nextjs" | "vite" | "eslint" | "global";
  /** Framework badge/hint */
  hint: string;
  /** Number of installed components */
  installedCount: number;
}

/**
 * Item to display in the selection list
 */
interface RemoveItem {
  id: string;
  installerId: string;
  installer: Installer;
  label: string;
  hint?: string;
  target: InstallTarget;
}

export interface RemoveAppProps {
  /** Project scan promise (resolves to ProjectState) */
  projectPromise: Promise<ProjectState>;
  /** Skip confirmation prompt */
  skipConfirmation?: boolean;
  /** Dry run mode - preview only */
  dryRun?: boolean;
  /** Callback when removal is complete */
  onComplete: (selections: InstallerSelection[]) => void;
  /** Callback when error occurs */
  onError?: (error: Error) => void;
}

/**
 * Get all projects that have installed UILint components
 */
function getProjectsWithInstalls(project: ProjectState): ProjectWithInstalls[] {
  const installers = getAllInstallers();
  const projects: ProjectWithInstalls[] = [];
  const seenPaths = new Set<string>();

  for (const installer of installers) {
    if (!installer.isApplicable(project)) continue;

    const targets = installer.getTargets(project);
    for (const target of targets) {
      if (!target.isInstalled) continue;

      // Determine project type and path
      let projectPath = target.path;
      let type: ProjectWithInstalls["type"] = "global";
      let hint = "Other";

      if (installer.id === "next") {
        type = "nextjs";
        hint = "Next.js App Router";
      } else if (installer.id === "vite") {
        type = "vite";
        hint = "Vite + React";
      } else if (installer.id === "eslint") {
        type = "eslint";
        hint = "ESLint";
      } else if (installer.id === "genstyleguide" || installer.id === "skill") {
        // Global features - group them under workspace root
        projectPath = project.workspaceRoot;
        type = "global";
        hint = "Global";
      }

      // Avoid duplicates
      if (seenPaths.has(projectPath)) {
        // Increment count for existing project
        const existing = projects.find(p => p.path === projectPath);
        if (existing) {
          existing.installedCount++;
        }
        continue;
      }

      seenPaths.add(projectPath);
      const relativePath = projectPath.replace(project.workspaceRoot + "/", "");

      projects.push({
        id: `${type}:${projectPath}`,
        name: relativePath || ".",
        path: projectPath,
        type,
        hint,
        installedCount: 1,
      });
    }
  }

  return projects;
}

/**
 * Get installed items for a specific project path
 */
function getInstalledItemsForProject(
  project: ProjectState,
  selectedProject: ProjectWithInstalls | null
): RemoveItem[] {
  const installers = getAllInstallers();
  const items: RemoveItem[] = [];

  for (const installer of installers) {
    if (!installer.isApplicable(project)) continue;

    const targets = installer.getTargets(project);
    for (const target of targets) {
      if (!target.isInstalled) continue;

      // Filter by selected project if one is selected
      if (selectedProject) {
        // For global installers, only show if "global" project is selected
        if (installer.id === "genstyleguide" || installer.id === "skill") {
          if (selectedProject.type !== "global") continue;
        } else {
          // For project-specific installers, match by path
          if (target.path !== selectedProject.path) continue;
        }
      }

      items.push({
        id: `${installer.id}:${target.id}`,
        installerId: installer.id,
        installer,
        label: installer.name,
        hint: target.hint,
        target,
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
 * Framework badge for project selector
 */
function FrameworkBadge({ type }: { type: ProjectWithInstalls["type"] }): React.ReactElement {
  switch (type) {
    case "nextjs":
      return <Text color="white" backgroundColor="black"> Next.js </Text>;
    case "vite":
      return <Text color="black" backgroundColor="yellow"> Vite </Text>;
    case "eslint":
      return <Text color="white" backgroundColor="blue"> ESLint </Text>;
    case "global":
      return <Text color="white" backgroundColor="magenta"> Global </Text>;
    default:
      return <Text dimColor>Other</Text>;
  }
}

/**
 * Project selector for choosing which project to remove from
 */
function ProjectSelector({
  projects,
  cursor,
  onSelect,
  onCancel,
}: {
  projects: ProjectWithInstalls[];
  cursor: number;
  onSelect: (project: ProjectWithInstalls) => void;
  onCancel: () => void;
}): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Select a project to remove components from:</Text>
      </Box>

      {projects.map((project, index) => {
        const isCursor = index === cursor;
        return (
          <Box key={project.id} paddingLeft={1}>
            {/* Cursor */}
            <Text color={isCursor ? "cyan" : undefined}>
              {isCursor ? "› " : "  "}
            </Text>

            {/* Framework badge */}
            <Box width={12}>
              <FrameworkBadge type={project.type} />
            </Box>

            {/* Project name */}
            <Box width={30}>
              <Text color={isCursor ? "cyan" : undefined} bold={isCursor}>
                {project.name}
              </Text>
            </Box>

            {/* Installed count */}
            <Text color="green" dimColor>
              {project.installedCount} installed
            </Text>
          </Box>
        );
      })}

      {/* Footer */}
      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text dimColor>
          <Text color="cyan">↑↓</Text> navigate{"  "}
          <Text color="cyan">enter</Text> select{"  "}
          <Text color="cyan">q</Text> quit
        </Text>
      </Box>
    </Box>
  );
}

/**
 * Selection item with checkbox
 */
function SelectionItem({
  item,
  isSelected,
  isCursor,
}: {
  item: RemoveItem;
  isSelected: boolean;
  isCursor: boolean;
}): React.ReactElement {
  return (
    <Box paddingLeft={2}>
      <Text color={isCursor ? "cyan" : undefined}>
        {isCursor ? "› " : "  "}
      </Text>
      <Box width={2}>
        <Text color={isSelected ? "red" : "gray"}>
          {isSelected ? "✗" : "○"}
        </Text>
      </Box>
      <Box width={28}>
        <Text
          color={isSelected ? "red" : isCursor ? "cyan" : undefined}
        >
          {item.label}
        </Text>
      </Box>
      <Box width={20}>
        <Text dimColor>{item.hint || ""}</Text>
      </Box>
      <Text color="green" dimColor>installed</Text>
    </Box>
  );
}

/**
 * Selection list component
 */
function SelectionList({
  items,
  selectedIds,
  cursor,
  selectedProject,
  canGoBack,
  onBack,
}: {
  items: RemoveItem[];
  selectedIds: Set<string>;
  cursor: number;
  selectedProject: ProjectWithInstalls | null;
  canGoBack: boolean;
  onBack: () => void;
}): React.ReactElement {
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

      <Box marginBottom={1}>
        <Text>Select components to remove:</Text>
      </Box>

      {items.map((item, index) => (
        <SelectionItem
          key={item.id}
          item={item}
          isSelected={selectedIds.has(item.id)}
          isCursor={index === cursor}
        />
      ))}

      {/* Footer with keyboard hints */}
      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text dimColor>
          <Text color="cyan">↑↓</Text> navigate{"  "}
          <Text color="cyan">space</Text> toggle{"  "}
          <Text color="cyan">a</Text> all{"  "}
          <Text color="cyan">n</Text> none{"  "}
          <Text color="cyan">enter</Text> remove{"  "}
          <Text color="cyan">q</Text> quit
        </Text>
      </Box>

      {/* Back hint if multiple projects */}
      {canGoBack && (
        <Box marginTop={1}>
          <Text dimColor>
            Press <Text color="cyan">b</Text> or <Text color="cyan">←</Text> to select a different project
          </Text>
        </Box>
      )}

      {/* Selection summary */}
      <Box marginTop={1}>
        <Text>
          <Text color="red">{selectedIds.size}</Text>
          <Text dimColor> to remove</Text>
        </Text>
      </Box>
    </Box>
  );
}

/**
 * Confirmation component
 */
function Confirmation({
  items,
  selectedIds,
  dryRun,
  onConfirm,
  onBack,
}: {
  items: RemoveItem[];
  selectedIds: Set<string>;
  dryRun?: boolean;
  onConfirm: () => void;
  onBack: () => void;
}): React.ReactElement {
  const selectedItems = items.filter((item) => selectedIds.has(item.id));

  useInput((input, key) => {
    if (input === "y" || key.return) {
      onConfirm();
    } else if (input === "n" || key.escape || input === "b") {
      onBack();
    }
  });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>
          {dryRun ? "Preview: Would remove" : "Confirm removal of"} {selectedItems.length} component(s):
        </Text>
      </Box>

      {selectedItems.map((item) => (
        <Box key={item.id} paddingLeft={2}>
          <Text color="red">✗ </Text>
          <Text>{item.label}</Text>
          {item.hint && <Text dimColor> ({item.hint})</Text>}
        </Box>
      ))}

      <Box marginTop={1}>
        {dryRun ? (
          <Text dimColor>
            Dry run mode - no changes will be made.{" "}
            Press <Text color="cyan">enter</Text> to see details or <Text color="cyan">b</Text> to go back.
          </Text>
        ) : (
          <Text dimColor>
            Press <Text color="cyan">y</Text> or <Text color="cyan">enter</Text> to confirm, <Text color="cyan">n</Text> or <Text color="cyan">b</Text> to go back.
          </Text>
        )}
      </Box>
    </Box>
  );
}

export function RemoveApp({
  projectPromise,
  skipConfirmation = false,
  dryRun = false,
  onComplete,
  onError,
}: RemoveAppProps): React.ReactElement {
  const { exit } = useApp();
  const [phase, setPhase] = useState<RemovePhase>("loading");
  const [project, setProject] = useState<ProjectState | null>(null);
  const [projectsWithInstalls, setProjectsWithInstalls] = useState<ProjectWithInstalls[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectWithInstalls | null>(null);
  const [items, setItems] = useState<RemoveItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState(0);
  const [projectCursor, setProjectCursor] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  // Phase 1: Load project
  useEffect(() => {
    if (phase !== "loading") return;

    projectPromise
      .then((proj) => {
        setProject(proj);

        const projects = getProjectsWithInstalls(proj);
        setProjectsWithInstalls(projects);

        if (projects.length === 0) {
          setError(new Error("No UILint components are installed in this project."));
          setPhase("error");
          return;
        }

        // If only one project has installed components, skip project selection
        if (projects.length === 1) {
          const singleProject = projects[0]!;
          setSelectedProject(singleProject);
          const installedItems = getInstalledItemsForProject(proj, singleProject);
          setItems(installedItems);
          setPhase("select");
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

  // Keyboard input for project selection phase
  useInput((input, key) => {
    if (phase === "select-project") {
      if (key.upArrow) {
        setProjectCursor((prev) => (prev > 0 ? prev - 1 : projectsWithInstalls.length - 1));
      } else if (key.downArrow) {
        setProjectCursor((prev) => (prev < projectsWithInstalls.length - 1 ? prev + 1 : 0));
      } else if (key.return) {
        const selected = projectsWithInstalls[projectCursor];
        if (selected && project) {
          setSelectedProject(selected);
          const installedItems = getInstalledItemsForProject(project, selected);
          setItems(installedItems);
          setCursor(0);
          setSelectedIds(new Set());
          setPhase("select");
        }
      } else if (input === "q" || key.escape) {
        exit();
      }
      return;
    }

    if (phase !== "select") return;

    if (key.upArrow) {
      setCursor((prev) => (prev > 0 ? prev - 1 : items.length - 1));
    } else if (key.downArrow) {
      setCursor((prev) => (prev < items.length - 1 ? prev + 1 : 0));
    } else if (input === " ") {
      // Toggle selection
      const item = items[cursor];
      if (item) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(item.id)) {
            next.delete(item.id);
          } else {
            next.add(item.id);
          }
          return next;
        });
      }
    } else if (input === "a") {
      // Select all
      setSelectedIds(new Set(items.map((item) => item.id)));
    } else if (input === "n") {
      // Select none
      setSelectedIds(new Set());
    } else if (key.return) {
      // Submit
      if (selectedIds.size === 0) {
        // Nothing selected - exit
        exit();
        return;
      }
      if (skipConfirmation) {
        finishSelection();
      } else {
        setPhase("confirm");
      }
    } else if ((input === "b" || key.leftArrow) && projectsWithInstalls.length > 1) {
      // Go back to project selection
      setSelectedProject(null);
      setPhase("select-project");
    } else if (input === "q" || key.escape) {
      exit();
    }
  });

  // Build installer selections from selected IDs
  const finishSelection = () => {
    if (!project) return;

    const selections: InstallerSelection[] = [];

    // Group selected items by installer
    const installerMap = new Map<string, { installer: Installer; targets: InstallTarget[] }>();

    for (const item of items) {
      if (!selectedIds.has(item.id)) continue;

      const existing = installerMap.get(item.installerId);
      if (existing) {
        existing.targets.push(item.target);
      } else {
        installerMap.set(item.installerId, {
          installer: item.installer,
          targets: [item.target],
        });
      }
    }

    for (const [, { installer, targets }] of installerMap) {
      selections.push({
        installer,
        targets,
        selected: true,
      });
    }

    onComplete(selections);
  };

  // Render: Loading
  if (phase === "loading") {
    return (
      <Box flexDirection="column">
        <Header subtitle="Remove" />
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
        <Header subtitle="Remove" />
        <ProjectSelector
          projects={projectsWithInstalls}
          cursor={projectCursor}
          onSelect={(selected) => {
            if (project) {
              setSelectedProject(selected);
              const installedItems = getInstalledItemsForProject(project, selected);
              setItems(installedItems);
              setCursor(0);
              setSelectedIds(new Set());
              setPhase("select");
            }
          }}
          onCancel={() => exit()}
        />
      </Box>
    );
  }

  // Render: Selection
  if (phase === "select") {
    return (
      <Box flexDirection="column">
        <Header subtitle="Remove" />
        <SelectionList
          items={items}
          selectedIds={selectedIds}
          cursor={cursor}
          selectedProject={selectedProject}
          canGoBack={projectsWithInstalls.length > 1}
          onBack={() => {
            setSelectedProject(null);
            setPhase("select-project");
          }}
        />
      </Box>
    );
  }

  // Render: Confirmation
  if (phase === "confirm") {
    return (
      <Box flexDirection="column">
        <Header subtitle="Remove" />
        <Confirmation
          items={items}
          selectedIds={selectedIds}
          dryRun={dryRun}
          onConfirm={finishSelection}
          onBack={() => setPhase("select")}
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
