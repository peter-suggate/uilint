// icons.tsx - Re-export Lucide icons for UILint UI
// Using lucide-react for consistent, well-designed icons

import React from "react";

/**
 * Custom UILint Inspector icon - layered UI elements with status indicator
 * Represents inspecting UI components for issues
 */
export function UILintInspectorIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Back layer - UI component */}
      <rect x="3" y="3" width="12" height="12" rx="2" opacity="0.4" />
      {/* Front layer - UI component */}
      <rect x="9" y="9" width="12" height="12" rx="2" />
      {/* Status dot - represents linting indicator */}
      <circle cx="18" cy="6" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export {
  // Brand/logo - using CheckSquare as UILint logo
  CheckSquare as UILintIcon,
  // Search
  Search as SearchIcon,
  // Close
  X as CloseIcon,
  // Severity indicators
  AlertTriangle as WarningIcon,
  XCircle as ErrorIcon,
  Info as InfoIcon,
  // File and navigation
  File as FileIcon,
  FileCode as FileCodeIcon,
  List as RuleIcon,
  Scale as RuleScaleIcon,
  ChevronRight as ChevronRightIcon,
  ChevronRight as ChevronIcon,
  ChevronDown as ChevronDownIcon,
  ExternalLink as ExternalLinkIcon,
  // Settings and actions
  Settings as SettingsIcon,
  Check as CheckIcon,
  Wifi as ConnectionIcon,
  // Command palette actions
  Play as PlayIcon,
  Square as StopIcon,
  RotateCcw as RefreshIcon,
  // Inspector dock/float toggle
  Maximize2 as MaximizeIcon,
  PanelRight as DockIcon,
} from "lucide-react";
