/**
 * Tile - Glassmorphic tile component for mosaic grid
 *
 * iOS-style glassmorphic design:
 * - Translucent background with backdrop blur
 * - Minimal color palette
 * - Large, light-weight fonts
 * - Clean, modern aesthetic
 */
import React from "react";
import { motion } from "motion/react";
import type { TileItem, TileBucket } from "../../../core/plugin-system/types";

interface TileProps {
  item: TileItem;
  bucket: TileBucket;
  isSelected: boolean;
  onClick: () => void;
}

/**
 * Crisp easing curve for animations
 */
const crispEase = [0.32, 0.72, 0, 1] as const;

/**
 * Font sizes based on bucket
 */
const titleFontSizes: Record<TileBucket, number> = {
  xs: 15,
  sm: 17,
  md: 20,
  lg: 24,
  xl: 28,
};

/**
 * Count font sizes based on bucket
 */
const countFontSizes: Record<TileBucket, number> = {
  xs: 20,
  sm: 24,
  md: 32,
  lg: 40,
  xl: 52,
};

export function Tile({ item, bucket, isSelected, onClick }: TileProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  const titleSize = titleFontSizes[bucket];
  const countSize = countFontSizes[bucket];
  const isCompact = bucket === "xs" || bucket === "sm";

  return (
    <motion.div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{
        duration: 0.15,
        ease: crispEase,
      }}
      style={{
        height: "100%",
        padding: isCompact ? "12px 14px" : "16px 20px",
        borderRadius: 16,
        cursor: "pointer",
        // Glassmorphic background
        background: isSelected
          ? "rgba(255, 255, 255, 0.15)"
          : "rgba(255, 255, 255, 0.08)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        // Subtle border
        border: isSelected
          ? "1px solid rgba(255, 255, 255, 0.3)"
          : "1px solid rgba(255, 255, 255, 0.1)",
        // Layout
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
        // Subtle shadow for depth
        boxShadow: isSelected
          ? "0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)"
          : "0 4px 16px rgba(0, 0, 0, 0.2)",
      }}
    >
      {/* Top section: Label */}
      <div>
        <span
          style={{
            fontSize: titleSize,
            fontWeight: 300,
            color: "rgba(255, 255, 255, 0.95)",
            lineHeight: 1.2,
            letterSpacing: "-0.02em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: isCompact ? 1 : 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {item.label}
        </span>

        {/* Subtitle - path or description */}
        {item.subtitle && !isCompact && (
          <div
            style={{
              fontSize: 12,
              fontWeight: 400,
              color: "rgba(255, 255, 255, 0.45)",
              marginTop: 6,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              letterSpacing: "0.01em",
            }}
          >
            {item.subtitle}
          </div>
        )}
      </div>

      {/* Bottom section: Count and severity */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        {/* Large count number */}
        <span
          style={{
            fontSize: countSize,
            fontWeight: 200,
            color: "rgba(255, 255, 255, 0.9)",
            lineHeight: 1,
            letterSpacing: "-0.03em",
          }}
        >
          {item.count}
        </span>

        {/* Severity indicators - minimal dots */}
        {item.severityCounts && (
          <div
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              paddingBottom: 4,
            }}
          >
            {item.severityCounts.error > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    backgroundColor: "#ff6b6b",
                  }}
                />
                {!isCompact && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 400,
                      color: "rgba(255, 255, 255, 0.5)",
                    }}
                  >
                    {item.severityCounts.error}
                  </span>
                )}
              </div>
            )}
            {item.severityCounts.warning > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    backgroundColor: "#ffd93d",
                  }}
                />
                {!isCompact && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 400,
                      color: "rgba(255, 255, 255, 0.5)",
                    }}
                  >
                    {item.severityCounts.warning}
                  </span>
                )}
              </div>
            )}
            {item.severityCounts.info > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    backgroundColor: "#74b9ff",
                  }}
                />
                {!isCompact && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 400,
                      color: "rgba(255, 255, 255, 0.5)",
                    }}
                  >
                    {item.severityCounts.info}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Hover highlight overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isHovered ? 1 : 0 }}
        transition={{ duration: 0.15 }}
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, transparent 50%)",
          pointerEvents: "none",
          borderRadius: 16,
        }}
      />
    </motion.div>
  );
}

export type { TileProps };
