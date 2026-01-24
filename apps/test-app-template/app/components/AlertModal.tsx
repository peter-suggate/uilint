"use client";

import React, { useEffect, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button as MuiButton,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

interface AlertModalProps {
  open: boolean;
  onDismiss: () => void;
  onAccept: () => void;
  heading: string;
  body: string;
  acceptText?: string;
  dismissText?: string;
  severity?: "error" | "warning" | "info";
}

/**
 * Alert modal component using MUI Dialog
 * NOTE: Same functionality as ConfirmDialog but different UI library
 */
export function AlertModal({
  open,
  onDismiss,
  onAccept,
  heading,
  body,
  acceptText = "Confirm",
  dismissText = "Cancel",
  severity = "error",
}: AlertModalProps) {
  // Handle escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onDismiss();
      }
    },
    [onDismiss]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, handleKeyDown]);

  const severityColors = {
    error: { bg: "#FEE2E2", icon: "#DC2626" },
    warning: { bg: "#FEF3C7", icon: "#D97706" },
    info: { bg: "#DBEAFE", icon: "#2563EB" },
  };

  const acceptButtonColor = severity === "error" ? "error" : "primary";

  return (
    <Dialog
      open={open}
      onClose={onDismiss}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <IconButton
        aria-label="close"
        onClick={onDismiss}
        sx={{ position: "absolute", right: 8, top: 8, color: "grey.500" }}
      >
        <CloseIcon />
      </IconButton>

      <DialogContent sx={{ display: "flex", alignItems: "flex-start", gap: 2, pt: 3 }}>
        <div
          style={{
            padding: 12,
            borderRadius: "50%",
            backgroundColor: severityColors[severity].bg,
          }}
        >
          <WarningAmberIcon sx={{ color: severityColors[severity].icon, fontSize: 24 }} />
        </div>
        <div>
          <DialogTitle sx={{ p: 0, mb: 1 }}>{heading}</DialogTitle>
          <DialogContentText>{body}</DialogContentText>
        </div>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <MuiButton variant="outlined" onClick={onDismiss}>
          {dismissText}
        </MuiButton>
        <MuiButton variant="contained" color={acceptButtonColor} onClick={onAccept}>
          {acceptText}
        </MuiButton>
      </DialogActions>
    </Dialog>
  );
}
