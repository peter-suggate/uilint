import React from "react";
import { STYLES } from "./toolbar-styles";

/**
 * Toggle switch for settings
 */
export function SettingToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 0",
        cursor: "pointer",
      }}
    >
      <span style={{ fontSize: "12px", color: STYLES.textMuted }}>{label}</span>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: "36px",
          height: "20px",
          borderRadius: "10px",
          backgroundColor: checked ? STYLES.accent : "rgba(75, 85, 99, 0.5)",
          position: "relative",
          transition: "background-color 0.2s",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "2px",
            left: checked ? "18px" : "2px",
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            backgroundColor: "#FFFFFF",
            transition: "left 0.2s",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.2)",
          }}
        />
      </div>
    </label>
  );
}
