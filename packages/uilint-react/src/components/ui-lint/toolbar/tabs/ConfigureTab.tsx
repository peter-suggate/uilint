"use client";

import React from "react";
import { useUILintStore } from "../../store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Icons } from "../icons";

export function ConfigureTab() {
  const wsConnected = useUILintStore((s) => s.wsConnected);
  const wsUrl = useUILintStore((s) => s.wsUrl);
  const connectWebSocket = useUILintStore((s) => s.connectWebSocket);
  const disconnectWebSocket = useUILintStore((s) => s.disconnectWebSocket);

  const liveScanEnabled = useUILintStore((s) => s.liveScanEnabled);
  const enableLiveScan = useUILintStore((s) => s.enableLiveScan);
  const disableLiveScan = useUILintStore((s) => s.disableLiveScan);

  return (
    <div className="space-y-4">
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

      {/* Scan Controls */}
      <div className="space-y-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          ESLint Scanning
        </h4>
        <Button
          onClick={() =>
            liveScanEnabled ? disableLiveScan() : enableLiveScan(false)
          }
          variant={liveScanEnabled ? "destructive" : "default"}
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
    </div>
  );
}
