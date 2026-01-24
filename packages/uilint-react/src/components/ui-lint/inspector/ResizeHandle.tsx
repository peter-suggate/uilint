"use client";

import React, { useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ResizeHandleProps {
  /** Direction of resize */
  direction: "horizontal" | "vertical" | "corner";
  /** Called during resize with delta values */
  onResize: (deltaX: number, deltaY: number) => void;
  /** Called when resize ends */
  onResizeEnd?: () => void;
  /** Additional class names */
  className?: string;
}

/**
 * Reusable resize handle component
 * - horizontal: for docked sidebar width
 * - vertical: for floating sidebar height
 * - corner: for floating sidebar corner resize
 */
export function ResizeHandle({
  direction,
  onResize,
  onResizeEnd,
  className,
}: ResizeHandleProps) {
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDragging.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
    },
    []
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;

      const deltaX = e.clientX - lastPos.current.x;
      const deltaY = e.clientY - lastPos.current.y;
      lastPos.current = { x: e.clientX, y: e.clientY };

      onResize(deltaX, deltaY);
    };

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        onResizeEnd?.();
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [onResize, onResizeEnd]);

  const cursorClass =
    direction === "horizontal"
      ? "cursor-col-resize"
      : direction === "vertical"
      ? "cursor-row-resize"
      : "cursor-nwse-resize";

  return (
    <div
      data-ui-lint
      onMouseDown={handleMouseDown}
      className={cn(
        "absolute z-10",
        cursorClass,
        direction === "horizontal" && "top-0 left-0 w-1 h-full hover:bg-accent/30",
        direction === "vertical" && "bottom-0 left-0 w-full h-1 hover:bg-accent/30",
        direction === "corner" && "bottom-0 right-0 w-3 h-3 hover:bg-accent/30",
        className
      )}
    />
  );
}
