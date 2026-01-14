/**
 * FeatureSelector component - multi-select UI for choosing what to install
 */

import React from "react";
import { Box, Text } from "ink";
import { MultiSelect } from "./MultiSelect.js";
import type { InstallerSelection } from "../installers/types.js";

export interface FeatureSelectorProps {
  installers: InstallerSelection[];
  onSubmit: (selected: InstallerSelection[]) => void;
}

export function FeatureSelector({
  installers,
  onSubmit,
}: FeatureSelectorProps): React.ReactElement {
  const options = installers.flatMap((selection) => {
    const { installer, targets } = selection;

    // If installer has no targets or only one target, show as single option
    if (targets.length <= 1) {
      const target = targets[0];
      return [
        {
          label: `${installer.icon || ""} ${installer.name}`,
          value: installer.id,
          hint: target?.hint,
        },
      ];
    }

    // If installer has multiple targets, show each as separate option
    return targets.map((target) => ({
      label: `${installer.icon || ""} ${installer.name} → ${target.label}`,
      value: `${installer.id}:${target.id}`,
      hint: target.hint,
    }));
  });

  const defaultValues = installers
    .filter((sel) => sel.selected)
    .flatMap((sel) => {
      if (sel.targets.length <= 1) {
        return [sel.installer.id];
      }
      return sel.targets.map((t) => `${sel.installer.id}:${t.id}`);
    });

  return (
    <Box flexDirection="column">
      <Text bold>What would you like to set up?</Text>
      <Text dimColor>
        Use <Text color="cyan">↑↓</Text> to move, <Text color="cyan">space</Text> to
        toggle, <Text color="cyan">enter</Text> to confirm
      </Text>
      <Text> </Text>

      <MultiSelect
        options={options}
        defaultValues={defaultValues}
        onSubmit={(selected) => {
          // Parse selected values back into InstallerSelection[]
          const selectedSet = new Set(selected as string[]);
          const result = installers.map((sel) => {
            if (sel.targets.length <= 1) {
              return {
                ...sel,
                selected: selectedSet.has(sel.installer.id),
              };
            }

            // Multi-target installer - filter to selected targets
            const selectedTargets = sel.targets.filter((t) =>
              selectedSet.has(`${sel.installer.id}:${t.id}`)
            );

            return {
              ...sel,
              targets: selectedTargets,
              selected: selectedTargets.length > 0,
            };
          });

          onSubmit(result);
        }}
      />
    </Box>
  );
}
