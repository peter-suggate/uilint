/**
 * useTouchDrag - Unified drag handling for mouse and touch events
 */
import { useRef, useCallback, useEffect, useState } from "react";

interface Position {
  x: number;
  y: number;
}

interface DragState {
  isDragging: boolean;
  startPosition: Position;
  currentPosition: Position;
  delta: Position;
}

interface UseTouchDragOptions {
  onDragStart?: (position: Position) => void;
  onDragMove?: (position: Position, delta: Position) => void;
  onDragEnd?: (position: Position, velocity: Position) => void;
  threshold?: number;
}

export function useTouchDrag(options: UseTouchDragOptions = {}) {
  const { onDragStart, onDragMove, onDragEnd, threshold = 0 } = options;

  const [isDragging, setIsDragging] = useState(false);
  const startPosition = useRef<Position>({ x: 0, y: 0 });
  const lastPosition = useRef<Position>({ x: 0, y: 0 });
  const lastTime = useRef<number>(0);
  const velocity = useRef<Position>({ x: 0, y: 0 });
  const hasPassedThreshold = useRef(false);
  const isActive = useRef(false);

  const getEventPosition = useCallback(
    (e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent): Position => {
      if ("touches" in e) {
        const touch = e.touches[0] || e.changedTouches[0];
        return { x: touch.clientX, y: touch.clientY };
      }
      return { x: e.clientX, y: e.clientY };
    },
    []
  );

  const handleMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isActive.current) return;

      const position = getEventPosition(e);
      const now = Date.now();
      const dt = now - lastTime.current;

      if (dt > 0) {
        velocity.current = {
          x: (position.x - lastPosition.current.x) / dt * 1000,
          y: (position.y - lastPosition.current.y) / dt * 1000,
        };
      }

      const delta = {
        x: position.x - startPosition.current.x,
        y: position.y - startPosition.current.y,
      };

      if (!hasPassedThreshold.current) {
        const distance = Math.sqrt(delta.x ** 2 + delta.y ** 2);
        if (distance >= threshold) {
          hasPassedThreshold.current = true;
          setIsDragging(true);
          onDragStart?.(startPosition.current);
        }
      }

      if (hasPassedThreshold.current) {
        onDragMove?.(position, delta);
      }

      lastPosition.current = position;
      lastTime.current = now;
    },
    [getEventPosition, threshold, onDragStart, onDragMove]
  );

  const handleEnd = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isActive.current) return;

      isActive.current = false;
      const position = getEventPosition(e);

      if (hasPassedThreshold.current) {
        onDragEnd?.(position, velocity.current);
      }

      setIsDragging(false);
      hasPassedThreshold.current = false;
      velocity.current = { x: 0, y: 0 };
    },
    [getEventPosition, onDragEnd]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleEnd);
    document.addEventListener("touchmove", handleMove, { passive: false });
    document.addEventListener("touchend", handleEnd);
    document.addEventListener("touchcancel", handleEnd);

    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleEnd);
      document.removeEventListener("touchmove", handleMove);
      document.removeEventListener("touchend", handleEnd);
      document.removeEventListener("touchcancel", handleEnd);
    };
  }, [handleMove, handleEnd]);

  const handleStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const position = getEventPosition(e);
      startPosition.current = position;
      lastPosition.current = position;
      lastTime.current = Date.now();
      hasPassedThreshold.current = threshold === 0;
      isActive.current = true;

      if (threshold === 0) {
        setIsDragging(true);
        onDragStart?.(position);
      }
    },
    [getEventPosition, threshold, onDragStart]
  );

  return {
    isDragging,
    handlers: {
      onMouseDown: handleStart,
      onTouchStart: handleStart,
    },
  };
}
