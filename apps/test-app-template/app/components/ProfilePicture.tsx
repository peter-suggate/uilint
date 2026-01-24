"use client";

import React from "react";

interface ProfilePictureProps {
  fullName: string;
  photoSrc?: string;
  variant?: "small" | "medium" | "large";
  displayOnlineStatus?: boolean;
  onlineState?: "available" | "away" | "dnd";
}

/**
 * Profile picture component using pure Tailwind CSS
 * Shows initials if no photo provided
 * NOTE: Same core logic as UserAvatar but completely different UI implementation
 */
export function ProfilePicture({
  fullName,
  photoSrc,
  variant = "medium",
  displayOnlineStatus = false,
  onlineState = "away",
}: ProfilePictureProps) {
  // Extract initials from full name
  const initials = fullName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Map variant to size classes
  const sizeClasses = {
    small: "w-8 h-8 text-xs",
    medium: "w-12 h-12 text-sm",
    large: "w-20 h-20 text-xl",
  };

  // Map online state to indicator color
  const statusIndicatorColors = {
    available: "bg-emerald-400",
    away: "bg-slate-400",
    dnd: "bg-rose-500",
  };

  return (
    <div className="relative inline-flex">
      {photoSrc ? (
        <img
          src={photoSrc}
          alt={fullName}
          className={`${sizeClasses[variant]} rounded-full object-cover border-2 border-gray-200`}
        />
      ) : (
        <div
          className={`${sizeClasses[variant]} rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold`}
        >
          {initials}
        </div>
      )}
      {displayOnlineStatus && (
        <div
          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${statusIndicatorColors[onlineState]} rounded-full ring-2 ring-white`}
        />
      )}
    </div>
  );
}
