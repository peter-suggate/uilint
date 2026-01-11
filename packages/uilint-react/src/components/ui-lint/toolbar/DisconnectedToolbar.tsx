"use client";

import React from "react";
import { PillContainer, Divider } from "./shared";
import { TOKENS } from "./tokens";
import { Icons } from "./icons";

interface DisconnectedToolbarProps {
  onSettingsClick: () => void;
  showSettings: boolean;
}

export function DisconnectedToolbar({
  onSettingsClick,
  showSettings,
}: DisconnectedToolbarProps) {
  return (
    <PillContainer>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "0 12px",
          color: TOKENS.textMuted,
          fontSize: "12px",
        }}
      >
        <Icons.Unplug />
        <span>Not connected</span>
      </div>
      <Divider />
      <button
        className={`uilint-btn uilint-btn--icon ${
          showSettings ? "uilint-btn--accent" : ""
        }`}
        onClick={onSettingsClick}
        title="Settings"
        aria-label="Open settings"
        aria-pressed={showSettings}
      >
        <Icons.Settings />
      </button>
    </PillContainer>
  );
}
