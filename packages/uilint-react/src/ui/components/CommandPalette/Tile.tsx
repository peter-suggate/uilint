/**
 * Tile - Individual tile component for masonry grid display
 *
 * Displays aggregated data (rules, files, etc.) with:
 * - Primary label and count badge
 * - Optional severity breakdown bar (error/warning/info)
 * - Optional subtitle
 * - Hover lift effect with arrow indicator
 * - Selected state highlighting
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
 * Map bucket sizes to pixel heights
 */
const bucketHeights: Record<TileBucket, number> = {
  xs: 60,
  sm: 80,
  md: 110,
  lg: 150,
  xl: 200,
};

/**
 * Crisp easing curve for animations
 */
const crispEase = [0.32, 0.72, 0, 1] as const;

/**
 * SeverityBar - Horizontal bar showing proportional severity breakdown
 */
function SeverityBar({
  error,
  warning,
  info,
}: {
  error: number;
  warning: number;
  info: number;
}) {
  const total = error + warning + info;
  if (total === 0) return null;

  const errorPercent = (error / total) * 100;
  const warningPercent = (warning / total) * 100;
  const infoPercent = (info / total) * 100;

  return (
    <div
      style={{
        display: "flex",
        height: 4,
        borderRadius: 2,
        overflow: "hidden",
        backgroundColor: "var(--uilint-border)",
        marginTop: 8,
      }}
    >
      {error > 0 && (
        <div
          style={{
            width: `${errorPercent}%`,
            backgroundColor: "var(--uilint-error)",
            transition: "width 0.2s ease",
          }}
        />
      )}
      {warning > 0 && (
        <div
          style={{
            width: `${warningPercent}%`,
            backgroundColor: "var(--uilint-warning)",
            transition: "width 0.2s ease",
          }}
        />
      )}
      {info > 0 && (
        <div
          style={{
            width: `${infoPercent}%`,
            backgroundColor: "var(--uilint-info)",
            transition: "width 0.2s ease",
          }}
        />
      )}
    </div>
  );
}

export function Tile({ item, bucket, isSelected, onClick }: TileProps) {
  const height = bucketHeights[bucket];
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <motion.div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={{
        duration: 0.15,
        ease: crispEase,
      }}
      style={{
        height,
        padding: bucket === "xs" ? "10px 12px" : "14px 16px",
        borderRadius: "var(--uilint-card-radius, 12px)",
        cursor: "pointer",
        background: isSelected
          ? "var(--uilint-info-bg)"
          : "var(--uilint-surface-elevated)",
        border: isSelected
          ? "2px solid var(--uilint-accent)"
          : "1px solid var(--uilint-border)",
        boxShadow: isSelected
          ? "0 0 0 3px var(--uilint-info-bg), var(--uilint-card-shadow)"
          : "var(--uilint-card-shadow)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        overflow: "hidden",
        breakInside: "avoid",
        marginBottom: 12,
        boxSizing: "border-box",
      }}
    >
      {/* Top section: Label and count */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          {/* Icon and Label */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {item.icon && (
                <span style={{ flexShrink: 0, fontSize: 14 }}>{item.icon}</span>
              )}
              <span
                style={{
                  fontSize: bucket === "xs" || bucket === "sm" ? 13 : 14,
                  fontWeight: 600,
                  color: "var(--uilint-text-primary)",
                  lineHeight: 1.3,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: bucket === "xs" ? "nowrap" : "normal",
                  display: "-webkit-box",
                  WebkitLineClamp: bucket === "xs" ? 1 : 2,
                  WebkitBoxOrient: "vertical",
                }}
              >
                {item.label}
              </span>
            </div>
          </div>

          {/* Count badge */}
          <div
            style={{
              flexShrink: 0,
              padding: "2px 8px",
              borderRadius: 10,
              backgroundColor: isSelected
                ? "var(--uilint-accent)"
                : "var(--uilint-surface)",
              color: isSelected
                ? "white"
                : "var(--uilint-text-secondary)",
              fontSize: 12,
              fontWeight: 600,
              lineHeight: 1.4,
            }}
          >
            {item.count}
          </div>
        </div>

        {/* Subtitle (only for larger tiles) */}
        {item.subtitle && bucket !== "xs" && (
          <div
            style={{
              fontSize: 12,
              color: "var(--uilint-text-muted)",
              marginTop: 4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: bucket === "sm" ? "nowrap" : "normal",
              display: "-webkit-box",
              WebkitLineClamp: bucket === "sm" ? 1 : 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {item.subtitle}
          </div>
        )}
      </div>

      {/* Bottom section: Severity bar and hover arrow */}
      <div>
        {/* Severity breakdown bar */}
        {item.severityCounts && (
          <SeverityBar
            error={item.severityCounts.error}
            warning={item.severityCounts.warning}
            info={item.severityCounts.info}
          />
        )}

        {/* Hover arrow indicator */}
        <motion.div
          initial={{ opacity: 0, x: -4 }}
          animate={{
            opacity: isHovered ? 1 : 0,
            x: isHovered ? 0 : -4,
          }}
          transition={{
            duration: 0.12,
            ease: crispEase,
          }}
          style={{
            position: "absolute",
            bottom: bucket === "xs" ? 10 : 14,
            right: bucket === "xs" ? 12 : 16,
            fontSize: 14,
            color: "var(--uilint-accent)",
            fontWeight: 500,
          }}
        >
          {"\u2192"}
        </motion.div>
      </div>
    </motion.div>
  );
}

export type { TileProps };
