/**
 * ProjectSummary component - displays detected project structure
 */

import React from "react";
import { Box, Text } from "ink";
import type { ProjectState } from "../types.js";

export interface ProjectSummaryProps {
  project: ProjectState;
}

export function ProjectSummary({ project }: ProjectSummaryProps): React.ReactElement {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
      <Text bold color="cyan">
        Your Project
      </Text>
      <Text> </Text>

      <Text>
        📦 Package Manager: <Text bold>{project.packageManager}</Text>
      </Text>

      {project.nextApps.length > 0 && (
        <>
          <Text> </Text>
          <Text color="blue">🔷 Next.js Apps:</Text>
          {project.nextApps.map((app) => (
            <Text key={app.projectPath}>
              {"   "}• {app.projectPath.split("/").pop() || app.projectPath}
              <Text dimColor> (App Router)</Text>
            </Text>
          ))}
        </>
      )}

      {project.viteApps.length > 0 && (
        <>
          <Text> </Text>
          <Text color="magenta">⚡ Vite Apps:</Text>
          {project.viteApps.map((app) => (
            <Text key={app.projectPath}>
              {"   "}• {app.projectPath.split("/").pop() || app.projectPath}
              <Text dimColor> (React + Vite)</Text>
            </Text>
          ))}
        </>
      )}

      {project.packages.filter((p) => p.eslintConfigPath).length > 0 && (
        <>
          <Text> </Text>
          <Text color="yellow">📝 ESLint Configs:</Text>
          {project.packages
            .filter((p) => p.eslintConfigPath)
            .map((pkg) => (
              <Text key={pkg.path}>
                {"   "}• {pkg.name}
                <Text dimColor> {pkg.eslintConfigFilename}</Text>
              </Text>
            ))}
        </>
      )}

      {(project.commands.genstyleguide || project.styleguide.exists) && (
        <>
          <Text> </Text>
          <Text color="green">✅ Already Installed:</Text>
          {project.commands.genstyleguide && (
            <Text>{"   "}• .cursor/commands/genstyleguide.md</Text>
          )}
          {project.styleguide.exists && <Text>{"   "}• .uilint/styleguide.md</Text>}
        </>
      )}
    </Box>
  );
}
