"use client";

import React from "react";
import { useUILintStore } from "../../store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Icons } from "../icons";

/**
 * Toggle switch component for settings
 */
function ToggleSwitch({
  enabled,
  onChange,
  label,
  description,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <button
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={cn(
          "relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
          enabled
            ? "bg-blue-600"
            : "bg-zinc-300 dark:bg-zinc-600"
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform",
            enabled ? "translate-x-[18px]" : "translate-x-0.5"
          )}
        />
      </button>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {label}
        </span>
        {description && (
          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-tight">
            {description}
          </p>
        )}
      </div>
    </label>
  );
}

/**
 * Section header component
 */
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
      {children}
    </h4>
  );
}

/**
 * Section container with border
 */
function SettingsSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 space-y-3">
      {children}
    </div>
  );
}

export function ConfigureTab() {
  const wsConnected = useUILintStore((s) => s.wsConnected);
  const wsUrl = useUILintStore((s) => s.wsUrl);
  const connectWebSocket = useUILintStore((s) => s.connectWebSocket);
  const disconnectWebSocket = useUILintStore((s) => s.disconnectWebSocket);

  const autoScanSettings = useUILintStore((s) => s.autoScanSettings);
  const updateAutoScanSettings = useUILintStore((s) => s.updateAutoScanSettings);

  const liveScanEnabled = useUILintStore((s) => s.liveScanEnabled);
  const enableLiveScan = useUILintStore((s) => s.enableLiveScan);
  const disableLiveScan = useUILintStore((s) => s.disableLiveScan);

  return (
    <ScrollArea className="flex-1 min-h-0 max-h-[50vh] -mx-3">
      <div className="px-3 space-y-4">
        {/* Connection Status */}
        <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                wsConnected
                  ? "bg-green-500 shadow-[0_0_8px_rgb(34,197,94)]"
                  : "bg-red-500 shadow-[0_0_8px_rgb(239,68,68)]"
              )}
            />
            <span className="text-xs font-medium">
              {wsConnected ? "Server Connected" : "Server Disconnected"}
            </span>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">{wsUrl}</span>
        </div>

        {!wsConnected && (
          <div className="p-2 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
            <p className="text-[10px] text-zinc-600 dark:text-zinc-400">
              Run{" "}
              <code className="bg-zinc-200 dark:bg-zinc-700 px-1 rounded">
                npx uilint serve
              </code>{" "}
              in your project root to connect.
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={() => connectWebSocket(wsUrl)}
            variant={wsConnected ? "outline" : "default"}
            size="sm"
            className="flex-1 h-8 text-xs"
          >
            {wsConnected ? "Reconnect" : "Connect"}
          </Button>
          {wsConnected && (
            <Button
              onClick={() => disconnectWebSocket()}
              variant="outline"
              size="sm"
              className="h-8 text-xs"
            >
              Disconnect
            </Button>
          )}
        </div>
      </div>

      <div className="h-px bg-zinc-200 dark:bg-zinc-800" />

      {/* ESLint Auto-Scan */}
      <div className="space-y-2">
        <SectionHeader>ESLint Auto-Scan</SectionHeader>
        <SettingsSection>
          <ToggleSwitch
            enabled={autoScanSettings.eslint.onPageLoad}
            onChange={(enabled) =>
              updateAutoScanSettings({ eslint: { onPageLoad: enabled } })
            }
            label="Auto-scan on page load"
            description="Automatically start ESLint scanning when the page loads"
          />
          <ToggleSwitch
            enabled={autoScanSettings.eslint.onFileChange}
            onChange={(enabled) =>
              updateAutoScanSettings({ eslint: { onFileChange: enabled } })
            }
            label="Re-scan on file changes"
            description="Re-scan files automatically when they change"
          />
        </SettingsSection>

        {/* Display Mode Toggle */}
        <div className="space-y-2">
          <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
            Display Mode
          </span>
          <div className="flex gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800">
            <button
              onClick={() =>
                updateAutoScanSettings({ eslint: { displayMode: "badges" } })
              }
              className={cn(
                "flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                autoScanSettings.eslint.displayMode === "badges"
                  ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100"
                  : "hover:bg-white/50 dark:hover:bg-zinc-700/50 text-zinc-600 dark:text-zinc-400"
              )}
            >
              <span className="flex items-center justify-center gap-1.5">
                <Icons.Badge className="w-3 h-3" />
                Badges
              </span>
            </button>
            <button
              onClick={() =>
                updateAutoScanSettings({ eslint: { displayMode: "heatmap" } })
              }
              className={cn(
                "flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                autoScanSettings.eslint.displayMode === "heatmap"
                  ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100"
                  : "hover:bg-white/50 dark:hover:bg-zinc-700/50 text-zinc-600 dark:text-zinc-400"
              )}
            >
              <span className="flex items-center justify-center gap-1.5">
                <Icons.Heatmap className="w-3 h-3" />
                Heatmap
              </span>
            </button>
          </div>
        </div>

        {/* Manual scan control */}
        <Button
          onClick={() =>
            liveScanEnabled ? disableLiveScan() : enableLiveScan(false)
          }
          variant={liveScanEnabled ? "destructive" : "outline"}
          size="sm"
          className="w-full gap-2"
        >
          {liveScanEnabled ? (
            <>
              <Icons.X className="w-3 h-3" />
              Stop Scanning
            </>
          ) : (
            <>
              <Icons.Play className="w-3 h-3" />
              Start Scanning
            </>
          )}
        </Button>
      </div>

      <div className="h-px bg-zinc-200 dark:bg-zinc-800" />

      {/* Vision Auto-Scan */}
      <div className="space-y-2">
        <SectionHeader>Vision Auto-Scan</SectionHeader>
        <SettingsSection>
          <ToggleSwitch
            enabled={autoScanSettings.vision.onRouteChange}
            onChange={(enabled) =>
              updateAutoScanSettings({ vision: { onRouteChange: enabled } })
            }
            label="Scan on route change"
            description="Automatically capture and analyze when navigating to new routes"
          />
          <ToggleSwitch
            enabled={autoScanSettings.vision.onInitialLoad}
            onChange={(enabled) =>
              updateAutoScanSettings({ vision: { onInitialLoad: enabled } })
            }
            label="Initial scan on load"
            description="Run vision analysis when the page first loads (off by default)"
          />
        </SettingsSection>
      </div>
      </div>
    </ScrollArea>
  );
}
