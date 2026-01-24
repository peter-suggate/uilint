/**
 * CompletionSummary component - displays installation results summary
 */

import React from "react";
import { Box, Text } from "ink";
import type { InstallResult } from "../types.js";

export interface CompletionSummaryProps {
  result: InstallResult;
}

/**
 * Displays a summary of installation results
 */
export function CompletionSummary({ result }: CompletionSummaryProps) {
  const { success, summary } = result;
  const hasErrors = !success;

  const stats: string[] = [];

  // Success/failure header
  const statusColor = success ? "green" : "yellow";
  const statusIcon = success ? "✓" : "⚠";
  const statusText = success
    ? "Installation completed successfully!"
    : "Installation completed with some errors";

  // Count stats
  const totalItems = summary.installedItems.length;
  const totalFiles =
    summary.filesCreated.length +
    summary.filesModified.length +
    summary.filesDeleted.length;

  stats.push(`${totalItems} feature(s) installed`);
  if (totalFiles > 0) {
    stats.push(`${totalFiles} file(s) affected`);
  }
  if (summary.dependenciesInstalled.length > 0) {
    const totalPackages = summary.dependenciesInstalled.reduce(
      (sum, dep) => sum + dep.packages.length,
      0
    );
    stats.push(`${totalPackages} package(s) installed`);
  }

  // Installed features
  const features: string[] = [];
  if (summary.installedItems.includes("genstyleguide")) {
    features.push("📝 Cursor Command: genstyleguide");
  }
  if (summary.installedItems.includes("skill")) {
    features.push("🤖 UI Consistency Agent Skill");
  }
  if (summary.nextApp) {
    features.push(`⚡ Next.js Overlay (${summary.nextApp.appRoot})`);
  }
  if (summary.viteApp) {
    features.push(`⚡ Vite Overlay (${summary.viteApp.entryRoot})`);
  }
  if (summary.eslintTargets.length > 0) {
    features.push(
      `🔍 ESLint Plugin (${summary.eslintTargets.length} config(s))`
    );
  }

  // Next steps
  const nextSteps: string[] = [];
  if (summary.installedItems.includes("genstyleguide")) {
    nextSteps.push("Restart Cursor to load new commands");
  }
  if (summary.nextApp || summary.viteApp) {
    nextSteps.push("Start your dev server and use Alt+Click to inspect elements");
  }
  if (summary.eslintTargets.length > 0) {
    nextSteps.push("Run ESLint to check for UI consistency issues");
    nextSteps.push("Run 'uilint serve' for real-time overlay integration");
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box
        borderStyle="round"
        borderColor={statusColor}
        paddingX={2}
        paddingY={1}
        flexDirection="column"
      >
        <Box>
          <Text color={statusColor} bold>
            {statusIcon} {statusText}
          </Text>
        </Box>
        <Text> </Text>
        {stats.map((stat, i) => (
          <Text key={i} dimColor>
            {stat}
          </Text>
        ))}
      </Box>

      {features.length > 0 && (
        <>
          <Text> </Text>
          <Text bold>Installed Features:</Text>
          {features.map((feature, i) => (
            <Text key={i}>  {feature}</Text>
          ))}
        </>
      )}

      {nextSteps.length > 0 && (
        <>
          <Text> </Text>
          <Text bold>Next Steps:</Text>
          {nextSteps.map((step, i) => (
            <Text key={i}>  {i + 1}. {step}</Text>
          ))}
        </>
      )}

      {hasErrors && (
        <>
          <Text> </Text>
          <Text color="yellow">
            ⚠ Some operations failed. Check the output above for details.
          </Text>
        </>
      )}
    </Box>
  );
}
