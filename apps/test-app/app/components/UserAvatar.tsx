"use client";

import React from "react";
import { Avatar } from "@mui/material";

interface UserAvatarProps {
  name: string;
  imageUrl?: string;
  size?: "sm" | "md" | "lg";
  showStatus?: boolean;
  status?: "online" | "offline" | "busy";
}

/**
 * User avatar component using MUI Avatar
 * Displays initials if no image provided
 */
export function UserAvatar({
  name,
  imageUrl,
  size = "md",
  showStatus = false,
  status = "offline",
}: UserAvatarProps) {
  // Extract initials from name
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Map size to pixel value
  const sizeMap = { sm: 32, md: 48, lg: 72 };
  const pixelSize = sizeMap[size];

  // Map status to color
  const statusColors = {
    online: "bg-green-500",
    offline: "bg-gray-400",
    busy: "bg-red-500",
  };

  return (
    <div className="relative inline-block">
      <Avatar
        src={imageUrl}
        alt={name}
        sx={{
          width: pixelSize,
          height: pixelSize,
          bgcolor: !imageUrl ? "primary.main" : undefined,
          fontSize: pixelSize * 0.4,
        }}
      >
        {!imageUrl && initials}
      </Avatar>
      {showStatus && (
        <span
          className={`absolute bottom-0 right-0 w-3 h-3 ${statusColors[status]} rounded-full border-2 border-white`}
        />
      )}
    </div>
  );
}
