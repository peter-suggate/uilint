"use client";

import React from "react";
import { useUILintStore } from "../store";
import { TOKENS } from "./tokens";
import { Icons } from "./icons";

interface CaptureModePopoverProps {
  onClose: () => void;
}

export function CaptureModePopover({ onClose }: CaptureModePopoverProps) {
  const captureMode = useUILintStore((s) => s.captureMode);
  const setCaptureMode = useUILintStore((s) => s.setCaptureMode);

  const handleSelectMode = (mode: "full" | "region") => {
    setCaptureMode(mode);
    onClose();
  };

  return (
    <div
      style={{
        minWidth: "180px",
        padding: "6px",
        borderRadius: "12px",
        border: `1px solid ${TOKENS.border}`,
        backgroundColor: TOKENS.bgElevated,
        backdropFilter: TOKENS.blur,
        WebkitBackdropFilter: TOKENS.blur,
        boxShadow: TOKENS.shadowMd,
        fontFamily: TOKENS.fontFamily,
      }}
    >
      {/* Full Page Option */}
      <button
        className="uilint-btn"
        onClick={() => handleSelectMode("full")}
        style={{
          width: "100%",
          justifyContent: "flex-start",
          padding: "8px 12px",
          borderRadius: "8px",
          fontSize: "13px",
          backgroundColor:
            captureMode === "full" ? TOKENS.bgActive : "transparent",
        }}
      >
        <Icons.Camera />
        <span style={{ flex: 1, textAlign: "left" }}>Full Page</span>
        {captureMode === "full" && (
          <span style={{ color: TOKENS.accent }}>
            <Icons.Check />
          </span>
        )}
      </button>

      {/* Region Option */}
      <button
        className="uilint-btn"
        onClick={() => handleSelectMode("region")}
        style={{
          width: "100%",
          justifyContent: "flex-start",
          padding: "8px 12px",
          borderRadius: "8px",
          fontSize: "13px",
          marginTop: "2px",
          backgroundColor:
            captureMode === "region" ? TOKENS.bgActive : "transparent",
        }}
      >
        <Icons.Crop />
        <span style={{ flex: 1, textAlign: "left" }}>Region</span>
        {captureMode === "region" && (
          <span style={{ color: TOKENS.accent }}>
            <Icons.Check />
          </span>
        )}
      </button>
    </div>
  );
}
