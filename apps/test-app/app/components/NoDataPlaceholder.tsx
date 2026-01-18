"use client";

import React, { ReactNode } from "react";
import { Button as MuiButton, Paper, Typography, Box } from "@mui/material";
import FolderOffIcon from "@mui/icons-material/FolderOff";

interface NoDataPlaceholderProps {
  heading: string;
  message: string;
  customIcon?: ReactNode;
  buttonText?: string;
  onButtonClick?: () => void;
}

/**
 * Placeholder component for empty data states
 * Uses MUI components
 * NOTE: Same core logic as EmptyState but different UI library
 */
export function NoDataPlaceholder({
  heading,
  message,
  customIcon,
  buttonText,
  onButtonClick,
}: NoDataPlaceholderProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        py: 6,
        px: 2,
        textAlign: "center",
        bgcolor: "grey.50",
        borderRadius: 2,
      }}
    >
      <Box
        sx={{
          width: 64,
          height: 64,
          bgcolor: "grey.200",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          mb: 2,
        }}
      >
        {customIcon || <FolderOffIcon sx={{ fontSize: 32, color: "grey.500" }} />}
      </Box>
      <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
        {heading}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 320, mb: 3 }}>
        {message}
      </Typography>
      {buttonText && onButtonClick && (
        <MuiButton variant="outlined" onClick={onButtonClick}>
          {buttonText}
        </MuiButton>
      )}
    </Paper>
  );
}
