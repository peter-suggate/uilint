/**
 * ProjectSelector - First step: select which project to configure
 *
 * Shows a simple list of detected projects (Next.js apps, Vite apps, etc.)
 * and lets the user select one to configure.
 */

import React, { useState } from "react";
import { Box, Text, useInput, useApp } from "ink";
import type { ProjectState } from "../types.js";

export interface DetectedProject {
  /** Unique ID */
  id: string;
  /** Project name/label */
  name: string;
  /** Project path (relative to workspace) */
  path: string;
  /** Framework type */
  type: "nextjs" | "vite" | "other";
  /** Framework badge/hint */
  hint: string;
  /** Whether UILint is already configured */
  isConfigured: boolean;
}

export interface ProjectSelectorProps {
  projects: DetectedProject[];
  onSelect: (project: DetectedProject) => void;
  onCancel?: () => void;
}

/**
 * Extract detected projects from ProjectState
 */
export function getDetectedProjects(project: ProjectState): DetectedProject[] {
  const projects: DetectedProject[] = [];

  // Add Next.js apps
  for (const app of project.nextApps) {
    const relativePath = app.projectPath.replace(project.workspaceRoot + "/", "");
    projects.push({
      id: `next:${app.projectPath}`,
      name: relativePath || ".",
      path: app.projectPath,
      type: "nextjs",
      hint: "Next.js App Router",
      isConfigured: false, // TODO: detect if overlay is installed
    });
  }

  // Add Vite apps
  for (const app of project.viteApps) {
    const relativePath = app.projectPath.replace(project.workspaceRoot + "/", "");
    projects.push({
      id: `vite:${app.projectPath}`,
      name: relativePath || ".",
      path: app.projectPath,
      type: "vite",
      hint: "Vite + React",
      isConfigured: false,
    });
  }

  return projects;
}

function FrameworkBadge({ type }: { type: DetectedProject["type"] }): React.ReactElement {
  switch (type) {
    case "nextjs":
      return <Text color="white" backgroundColor="black"> Next.js </Text>;
    case "vite":
      return <Text color="black" backgroundColor="yellow"> Vite </Text>;
    default:
      return <Text dimColor>Other</Text>;
  }
}

export function ProjectSelector({
  projects,
  onSelect,
  onCancel,
}: ProjectSelectorProps): React.ReactElement {
  const { exit } = useApp();
  const [cursor, setCursor] = useState(0);

  useInput((input, key) => {
    if (key.upArrow) {
      setCursor((prev) => (prev > 0 ? prev - 1 : projects.length - 1));
    } else if (key.downArrow) {
      setCursor((prev) => (prev < projects.length - 1 ? prev + 1 : 0));
    } else if (key.return) {
      const selected = projects[cursor];
      if (selected) {
        onSelect(selected);
      }
    } else if (input === "q" || key.escape) {
      onCancel?.();
      exit();
    }
  });

  if (projects.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">No projects detected.</Text>
        <Text dimColor>
          UILint works with Next.js (App Router) and Vite + React projects.
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Select a project to configure:</Text>
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

            {/* Status */}
            {project.isConfigured && (
              <Text color="green" dimColor>
                configured
              </Text>
            )}
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
