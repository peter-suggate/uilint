/**
 * IconButton - Reusable icon button component with motion animations
 *
 * Follows shadcn conventions with CVA variant handling.
 * Supports default, ghost, and glass variants with hover/tap animations.
 */
import * as React from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";

/**
 * Icon button variants using CVA
 *
 * Uses CSS variables from the design system:
 * - Sizing: --uilint-icon-button-size, --uilint-icon-button-size-sm, --uilint-icon-button-size-lg
 * - Radius: --uilint-icon-button-radius
 * - Colors: --uilint-hover, --uilint-active, --uilint-text-muted, --uilint-text-secondary
 * - Glass: --uilint-glass, --uilint-glass-border
 */
const iconButtonVariants = cva(
  // Base styles
  [
    "inline-flex items-center justify-center",
    "border-none outline-none",
    "cursor-pointer",
    "transition-colors",
    "disabled:pointer-events-none disabled:opacity-40",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        default: [
          "bg-[var(--uilint-hover)]",
          "text-[var(--uilint-text-secondary)]",
          "hover:bg-[var(--uilint-active)]",
          "hover:text-[var(--uilint-text-primary)]",
        ],
        ghost: [
          "bg-transparent",
          "text-[var(--uilint-text-muted)]",
          "hover:bg-[var(--uilint-hover)]",
          "hover:text-[var(--uilint-text-secondary)]",
        ],
        glass: [
          "bg-[var(--uilint-glass)]",
          "text-[var(--uilint-text-secondary)]",
          "border border-[var(--uilint-glass-border)]",
          "backdrop-blur-md",
          "hover:bg-[var(--uilint-glass-medium)]",
          "hover:text-[var(--uilint-text-primary)]",
        ],
      },
      size: {
        sm: [
          "w-[var(--uilint-icon-button-size-sm)]",
          "h-[var(--uilint-icon-button-size-sm)]",
          "rounded-[calc(var(--uilint-icon-button-radius)-2px)]",
          "[&_svg]:w-4 [&_svg]:h-4",
        ],
        default: [
          "w-[var(--uilint-icon-button-size)]",
          "h-[var(--uilint-icon-button-size)]",
          "rounded-[var(--uilint-icon-button-radius)]",
          "[&_svg]:w-[18px] [&_svg]:h-[18px]",
        ],
        lg: [
          "w-[var(--uilint-icon-button-size-lg)]",
          "h-[var(--uilint-icon-button-size-lg)]",
          "rounded-[calc(var(--uilint-icon-button-radius)+2px)]",
          "[&_svg]:w-5 [&_svg]:h-5",
        ],
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

/**
 * Motion variants for hover and tap animations
 */
const motionVariants = {
  initial: {
    scale: 1,
    boxShadow: "0 0 0 0 rgba(0, 0, 0, 0)",
  },
  hover: {
    scale: 1.05,
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
    transition: {
      type: "tween" as const,
      duration: 0.15,
      ease: [0.25, 0.1, 0.25, 1] as const,
    },
  },
  tap: {
    scale: 0.95,
    transition: {
      type: "tween" as const,
      duration: 0.1,
      ease: [0.25, 0.1, 0.25, 1] as const,
    },
  },
};

/**
 * Glass variant has a subtle glow effect on hover
 */
const glassMotionVariants = {
  initial: {
    scale: 1,
    boxShadow: "0 0 0 0 rgba(255, 255, 255, 0)",
  },
  hover: {
    scale: 1.05,
    boxShadow: "0 4px 16px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.1)",
    transition: {
      type: "tween" as const,
      duration: 0.15,
      ease: [0.25, 0.1, 0.25, 1] as const,
    },
  },
  tap: {
    scale: 0.95,
    transition: {
      type: "tween" as const,
      duration: 0.1,
      ease: [0.25, 0.1, 0.25, 1] as const,
    },
  },
};

export interface IconButtonProps
  extends Omit<HTMLMotionProps<"button">, "ref">,
    VariantProps<typeof iconButtonVariants> {
  /** Render as child component (for composition) */
  asChild?: boolean;
  /** Disable motion animations */
  disableMotion?: boolean;
}

/**
 * IconButton component with motion animations
 *
 * @example
 * ```tsx
 * // Default variant
 * <IconButton onClick={handleClick}>
 *   <SearchIcon />
 * </IconButton>
 *
 * // Ghost variant
 * <IconButton variant="ghost" onClick={handleClick}>
 *   <CloseIcon />
 * </IconButton>
 *
 * // Glass variant with small size
 * <IconButton variant="glass" size="sm" onClick={handleClick}>
 *   <SettingsIcon />
 * </IconButton>
 * ```
 */
const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      disableMotion = false,
      disabled,
      ...props
    },
    ref
  ) => {
    const classes = cn(iconButtonVariants({ variant, size, className }));

    // Use Slot for composition if asChild is true
    if (asChild) {
      return (
        <Slot
          ref={ref as React.Ref<HTMLElement>}
          className={classes}
          {...(props as React.HTMLAttributes<HTMLElement>)}
        />
      );
    }

    // If motion is disabled, render a regular button
    if (disableMotion || disabled) {
      return (
        <button
          ref={ref}
          className={classes}
          disabled={disabled}
          {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        />
      );
    }

    // Select motion variants based on button variant
    const selectedMotionVariants =
      variant === "glass" ? glassMotionVariants : motionVariants;

    return (
      <motion.button
        ref={ref}
        className={classes}
        disabled={disabled}
        variants={selectedMotionVariants}
        initial="initial"
        whileHover="hover"
        whileTap="tap"
        {...props}
      />
    );
  }
);

IconButton.displayName = "IconButton";

export { IconButton, iconButtonVariants };
