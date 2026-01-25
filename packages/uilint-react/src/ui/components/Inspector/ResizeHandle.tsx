/**
 * ResizeHandle - Reusable resize handle for inspector sidebar
 *
 * Supports horizontal (docked sidebar width), vertical (height), and corner (both) resize.
 */
import React, { useCallback, useRef, useEffect } from "react";

interface ResizeHandleProps {
  /** Direction of resize */
  direction: "horizontal" | "vertical" | "corner";
  /** Called during resize with delta values */
  onResize: (deltaX: number, deltaY: number) => void;
  /** Called when resize ends */
  onResizeEnd?: () => void;
}

export function ResizeHandle({
  direction,
  onResize,
  onResizeEnd,
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

  const baseStyle: React.CSSProperties = {
    position: "absolute",
    zIndex: 10,
  };

  const directionStyles: Record<typeof direction, React.CSSProperties> = {
    horizontal: {
      ...baseStyle,
      top: 0,
      left: 0,
      width: 4,
      height: "100%",
      cursor: "col-resize",
    },
    vertical: {
      ...baseStyle,
      bottom: 0,
      left: 0,
      width: "100%",
      height: 4,
      cursor: "row-resize",
    },
    corner: {
      ...baseStyle,
      bottom: 0,
      right: 0,
      width: 12,
      height: 12,
      cursor: "nwse-resize",
    },
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        ...directionStyles[direction],
        background: "transparent",
      }}
      onMouseEnter={(e) => {
        (e.target as HTMLDivElement).style.background = "rgba(59, 130, 246, 0.2)";
      }}
      onMouseLeave={(e) => {
        if (!isDragging.current) {
          (e.target as HTMLDivElement).style.background = "transparent";
        }
      }}
    />
  );
}
