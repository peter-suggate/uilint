"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Icons } from "./icons";

interface ActionTilesGridProps {
  liveScanEnabled: boolean;
  wsConnected: boolean;
  onToggleScan: () => void;
  onCaptureFullPage: () => void;
  onCaptureRegion: () => void;
  highlightedActions: Set<string>;
}

/**
 * Action tiles grid - displays scan toggle and capture actions as tiles
 * Inspired by Apple's home screen notification overlay
 */
export function ActionTilesGrid({
  liveScanEnabled,
  wsConnected,
  onToggleScan,
  onCaptureFullPage,
  onCaptureRegion,
  highlightedActions,
}: ActionTilesGridProps) {
  // Don't render if not connected
  if (!wsConnected) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex justify-center gap-3 px-4 py-4",
        "border-b border-white/10 dark:border-white/5"
      )}
      data-ui-lint
    >
      {/* Scan Toggle Tile */}
      <ActionTile
        icon={<Icons.Scan className="w-6 h-6" />}
        label="ESLint Scan"
        isHighlighted={highlightedActions.has("scan")}
        onClick={onToggleScan}
      >
        <ToggleSwitch enabled={liveScanEnabled} />
      </ActionTile>

      {/* Capture Full Page Tile */}
      <ActionTile
        icon={<Icons.Camera className="w-6 h-6" />}
        label="Full Page"
        isHighlighted={highlightedActions.has("capture-full")}
        onClick={onCaptureFullPage}
      />

      {/* Capture Region Tile */}
      <ActionTile
        icon={<Icons.Crop className="w-6 h-6" />}
        label="Region"
        isHighlighted={highlightedActions.has("capture-region")}
        onClick={onCaptureRegion}
      />
    </div>
  );
}

interface ActionTileProps {
  icon: React.ReactNode;
  label: string;
  isHighlighted?: boolean;
  onClick: () => void;
  children?: React.ReactNode;
}

/**
 * Individual action tile component
 */
function ActionTile({
  icon,
  label,
  isHighlighted = false,
  onClick,
  children,
}: ActionTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        // Size and layout
        "w-[140px] px-3 py-4",
        "flex flex-col items-center gap-2",

        // Glass effect background
        "bg-white/10 dark:bg-white/5",
        "backdrop-blur-sm",

        // Border and shape
        "rounded-xl",
        "border border-white/10 dark:border-white/5",

        // Transitions
        "transition-all duration-150",

        // Hover state
        "hover:bg-white/15 dark:hover:bg-white/10",
        "hover:scale-[1.02]",

        // Focus state
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50",

        // Highlighted state (search match)
        isHighlighted && "ring-2 ring-blue-400/70 bg-blue-500/10"
      )}
      data-ui-lint
    >
      {/* Icon */}
      <span className="text-zinc-600 dark:text-zinc-300">
        {icon}
      </span>

      {/* Label */}
      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
        {label}
      </span>

      {/* Optional child content (e.g., toggle switch) */}
      {children}
    </button>
  );
}

interface ToggleSwitchProps {
  enabled: boolean;
}

/**
 * Small toggle switch component for the scan tile
 */
function ToggleSwitch({ enabled }: ToggleSwitchProps) {
  return (
    <div
      className={cn(
        // Container
        "relative w-9 h-5 rounded-full",
        "transition-colors duration-200",

        // Background color based on state
        enabled
          ? "bg-blue-500"
          : "bg-zinc-400 dark:bg-zinc-600"
      )}
    >
      {/* Pill/knob */}
      <div
        className={cn(
          "absolute top-0.5 w-4 h-4 rounded-full",
          "bg-white shadow-sm",
          "transition-transform duration-200",

          // Position based on state
          enabled ? "translate-x-[18px]" : "translate-x-0.5"
        )}
      />
    </div>
  );
}
