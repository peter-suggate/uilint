"use client";

import React from "react";
import { useUILintContext } from "../UILintProvider";
import { PillContainer, Divider } from "./shared";
import { Icons } from "./icons";

interface IdleToolbarProps {
  onSettingsClick: () => void;
  showSettings: boolean;
}

export function IdleToolbar({
  onSettingsClick,
  showSettings,
}: IdleToolbarProps) {
  const { enableLiveScan } = useUILintContext();

  const handleStartScan = () => {
    enableLiveScan();
  };

  return (
    <PillContainer>
      <button
        className="uilint-btn uilint-btn--primary"
        onClick={handleStartScan}
        title="Start scanning (⌥S)"
        aria-label="Start live scanning"
      >
        <Icons.Eye />
        <span>Start Scanning</span>
      </button>
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
