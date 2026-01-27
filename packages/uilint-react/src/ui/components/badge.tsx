/**
 * Badge component - Status badges for displaying issue severities, counts, categories, etc.
 *
 * Follows shadcn conventions with:
 * - CVA (class-variance-authority) for variant handling
 * - motion/react for scale + fade animations
 * - CSS variables from the uilint design system
 */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, type HTMLMotionProps } from "motion/react";

import { cn } from "../../lib/utils";

/**
 * Badge variants using CVA
 *
 * Uses Tailwind utilities mapped to --uilint-* CSS variables via globals.css @theme
 */
const badgeVariants = cva(
  // Base styles
  "inline-flex items-center justify-center font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "bg-surface-elevated text-text-secondary border border-border",
        error:
          "bg-error-bg text-error border-0",
        warning:
          "bg-warning-bg text-warning border-0",
        success:
          "bg-success-bg text-success border-0",
        info:
          "bg-info-bg text-info border-0",
        outline:
          "bg-transparent text-text-secondary border border-border",
      },
      size: {
        sm: "px-1.5 py-0.5 text-[10px] leading-tight min-h-4",
        default: "px-2 py-0.5 text-xs leading-tight min-h-5",
        lg: "px-3 py-1 text-sm leading-tight min-h-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

// Crisp easing curve matching the codebase animation style
const crispEase = [0.32, 0.72, 0, 1] as const;

// Motion variants for scale + fade animation
const badgeMotionVariants = {
  initial: {
    opacity: 0,
    scale: 0.85,
  },
  animate: {
    opacity: 1,
    scale: 1,
  },
  exit: {
    opacity: 0,
    scale: 0.85,
  },
};

export interface BadgeProps
  extends Omit<HTMLMotionProps<"span">, "children">,
    VariantProps<typeof badgeVariants> {
  children: React.ReactNode;
  /** Disable motion animations */
  disableAnimation?: boolean;
}

/**
 * Badge - Animated status badge component
 *
 * @example
 * ```tsx
 * <Badge variant="error">3 errors</Badge>
 * <Badge variant="success" size="sm">Passed</Badge>
 * <Badge variant="warning" size="lg">Needs review</Badge>
 * ```
 */
function Badge({
  className,
  variant,
  size,
  children,
  disableAnimation = false,
  style,
  ...props
}: BadgeProps) {
  // Apply badge radius from CSS variable
  const badgeStyle = {
    borderRadius: "var(--uilint-badge-radius, 6px)",
    ...style,
  } as const;

  if (disableAnimation) {
    return (
      <span
        className={cn(badgeVariants({ variant, size }), className)}
        style={badgeStyle}
      >
        {children}
      </span>
    );
  }

  return (
    <motion.span
      className={cn(badgeVariants({ variant, size }), className)}
      style={badgeStyle}
      variants={badgeMotionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{
        duration: 0.15,
        ease: crispEase,
      }}
      {...props}
    >
      {children}
    </motion.span>
  );
}

/**
 * StatBadge - Badge with icon and label for displaying statistics
 *
 * Inspired by IssuesSummaryCard's StatBadge pattern
 *
 * @example
 * ```tsx
 * <StatBadge
 *   icon={<AlertCircle size={14} />}
 *   label="Errors"
 *   value={5}
 *   variant="error"
 * />
 * ```
 */
export interface StatBadgeProps extends VariantProps<typeof badgeVariants> {
  icon?: React.ReactNode;
  label: string;
  value: number | string;
  className?: string;
  /** Disable motion animations */
  disableAnimation?: boolean;
}

function StatBadge({
  icon,
  label,
  value,
  variant,
  size,
  className,
  disableAnimation = false,
}: StatBadgeProps) {
  const resolvedVariant = variant ?? "default";
  const resolvedSize = size ?? "default";

  const sizeStyles: Record<"sm" | "default" | "lg", {
    padding: string;
    gap: number;
    valueSize: number;
    labelSize: number;
  }> = {
    sm: {
      padding: "6px 8px",
      gap: 3,
      valueSize: 13,
      labelSize: 9,
    },
    default: {
      padding: "8px 10px",
      gap: 4,
      valueSize: 15,
      labelSize: 10,
    },
    lg: {
      padding: "10px 14px",
      gap: 5,
      valueSize: 18,
      labelSize: 11,
    },
  };

  const styles = sizeStyles[resolvedSize];

  // Get variant colors using CSS variables
  const variantColors: Record<string, { color: string; bgColor: string }> = {
    default: {
      color: "var(--uilint-text-secondary)",
      bgColor: "var(--uilint-surface-elevated)",
    },
    error: {
      color: "var(--uilint-error)",
      bgColor: "var(--uilint-error-bg)",
    },
    warning: {
      color: "var(--uilint-warning)",
      bgColor: "var(--uilint-warning-bg)",
    },
    success: {
      color: "var(--uilint-success)",
      bgColor: "var(--uilint-success-bg)",
    },
    info: {
      color: "var(--uilint-info)",
      bgColor: "var(--uilint-info-bg)",
    },
    outline: {
      color: "var(--uilint-text-secondary)",
      bgColor: "transparent",
    },
  };

  const colors = variantColors[resolvedVariant];

  const content = (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: styles.gap,
          marginBottom: 2,
        }}
      >
        {icon && (
          <span style={{ color: colors.color, display: "flex" }}>{icon}</span>
        )}
        <span
          style={{
            fontSize: styles.valueSize,
            fontWeight: 700,
            color: colors.color,
          }}
        >
          {value}
        </span>
      </div>
      <div
        style={{
          fontSize: styles.labelSize,
          color: "var(--uilint-text-muted)",
          fontWeight: 500,
        }}
      >
        {label}
      </div>
    </>
  );

  const containerStyle: React.CSSProperties = {
    padding: styles.padding,
    borderRadius: "var(--uilint-badge-radius, 8px)",
    background: colors.bgColor,
    textAlign: "center",
  };

  if (disableAnimation) {
    return (
      <div className={className} style={containerStyle}>
        {content}
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      style={containerStyle}
      variants={badgeMotionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{
        duration: 0.15,
        ease: crispEase,
      }}
    >
      {content}
    </motion.div>
  );
}

/**
 * CategoryBadge - Small uppercase badge for categories
 *
 * Inspired by CommandPalette's category badge pattern
 *
 * @example
 * ```tsx
 * <CategoryBadge>accessibility</CategoryBadge>
 * <CategoryBadge isSelected>performance</CategoryBadge>
 * ```
 */
export interface CategoryBadgeProps {
  children: React.ReactNode;
  isSelected?: boolean;
  className?: string;
  /** Disable motion animations */
  disableAnimation?: boolean;
}

function CategoryBadge({
  children,
  isSelected = false,
  className,
  disableAnimation = false,
}: CategoryBadgeProps) {
  const badgeStyle: React.CSSProperties = {
    fontSize: 9,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    background: isSelected
      ? "var(--uilint-info-bg)"
      : "var(--uilint-surface-elevated)",
    color: isSelected
      ? "var(--uilint-info)"
      : "var(--uilint-text-muted)",
    padding: "3px 8px",
    borderRadius: "var(--uilint-badge-radius, 6px)",
    transition: "all 0.1s ease",
  };

  if (disableAnimation) {
    return (
      <span className={className} style={badgeStyle}>
        {children}
      </span>
    );
  }

  return (
    <motion.span
      className={className}
      style={badgeStyle}
      variants={badgeMotionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{
        duration: 0.1,
        ease: crispEase,
      }}
    >
      {children}
    </motion.span>
  );
}

/**
 * CountBadge - Numeric count badge with automatic variant selection
 *
 * @example
 * ```tsx
 * <CountBadge count={0} /> // success variant
 * <CountBadge count={5} /> // warning variant
 * <CountBadge count={10} isError /> // error variant
 * ```
 */
export interface CountBadgeProps {
  count: number;
  /** Force error variant regardless of count */
  isError?: boolean;
  /** Use success variant when count is 0 (default: true) */
  zeroIsSuccess?: boolean;
  size?: "sm" | "default" | "lg";
  className?: string;
  /** Disable motion animations */
  disableAnimation?: boolean;
}

function CountBadge({
  count,
  isError = false,
  zeroIsSuccess = true,
  size = "default",
  className,
  disableAnimation = false,
}: CountBadgeProps) {
  let variant: "success" | "warning" | "error" = "warning";

  if (isError) {
    variant = "error";
  } else if (count === 0 && zeroIsSuccess) {
    variant = "success";
  }

  return (
    <Badge
      variant={variant}
      size={size}
      className={cn("font-mono tabular-nums", className)}
      disableAnimation={disableAnimation}
    >
      {count}
    </Badge>
  );
}

export { Badge, StatBadge, CategoryBadge, CountBadge, badgeVariants };
