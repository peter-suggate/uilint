/**
 * Button - shadcn-style button component with motion animations
 *
 * Features:
 * - Multiple variants (default, destructive, outline, secondary, ghost, glass)
 * - Size options (sm, default, lg, icon)
 * - Motion animations for hover and tap interactions
 * - Composition via asChild prop using Radix Slot
 * - CSS variable-based theming
 */
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, type HTMLMotionProps } from "motion/react";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  // Base styles
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "text-sm font-medium",
    "transition-colors duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        default: [
          "bg-[var(--uilint-button-default-bg)]",
          "text-[var(--uilint-button-default-text)]",
          "shadow-[var(--uilint-button-shadow)]",
          "hover:shadow-[var(--uilint-button-shadow-hover)]",
          "focus-visible:ring-[var(--uilint-button-default-bg)]",
        ],
        destructive: [
          "bg-[var(--uilint-button-destructive-bg)]",
          "text-[var(--uilint-button-destructive-text)]",
          "shadow-[var(--uilint-button-shadow)]",
          "hover:shadow-[var(--uilint-button-shadow-hover)]",
          "hover:bg-[var(--uilint-button-destructive-bg)]/90",
          "focus-visible:ring-[var(--uilint-button-destructive-bg)]",
        ],
        outline: [
          "bg-[var(--uilint-button-outline-bg)]",
          "text-[var(--uilint-button-outline-text)]",
          "border border-current/20",
          "hover:bg-[var(--uilint-button-outline-text)]/10",
          "focus-visible:ring-[var(--uilint-button-outline-text)]",
        ],
        secondary: [
          "bg-[var(--uilint-button-secondary-bg)]",
          "text-[var(--uilint-button-secondary-text)]",
          "shadow-[var(--uilint-button-shadow)]",
          "hover:shadow-[var(--uilint-button-shadow-hover)]",
          "hover:bg-[var(--uilint-button-secondary-bg)]/80",
          "focus-visible:ring-[var(--uilint-button-secondary-bg)]",
        ],
        ghost: [
          "bg-[var(--uilint-button-ghost-bg)]",
          "text-[var(--uilint-button-ghost-text)]",
          "hover:bg-[var(--uilint-button-ghost-text)]/10",
          "focus-visible:ring-[var(--uilint-button-ghost-text)]",
        ],
        glass: [
          "bg-[var(--uilint-button-glass-bg)]",
          "text-[var(--uilint-button-glass-text)]",
          "backdrop-blur-md",
          "border border-white/20",
          "shadow-[var(--uilint-button-shadow)]",
          "hover:shadow-[var(--uilint-button-shadow-hover)]",
          "hover:bg-white/30",
          "focus-visible:ring-white/50",
        ],
      },
      size: {
        default: "h-10 px-4 py-2 rounded-[var(--uilint-button-radius)]",
        sm: "h-8 px-3 text-xs rounded-[var(--uilint-button-radius)]",
        lg: "h-12 px-8 text-base rounded-[var(--uilint-button-radius)]",
        icon: "h-10 w-10 rounded-[var(--uilint-button-radius)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

// Motion animation variants
const motionVariants = {
  initial: { scale: 1 },
  hover: { scale: 1.02 },
  tap: { scale: 0.98 },
};

// Crisp easing curve matching the design system
const crispEase = [0.32, 0.72, 0, 1] as const;

const motionTransition = {
  duration: 0.15,
  ease: crispEase,
} as const;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Merge props onto child element instead of rendering a button */
  asChild?: boolean;
}

/**
 * Button component with motion animations and variant support.
 *
 * @example
 * ```tsx
 * // Default button
 * <Button>Click me</Button>
 *
 * // Destructive variant
 * <Button variant="destructive">Delete</Button>
 *
 * // Glass variant with icon size
 * <Button variant="glass" size="icon">
 *   <SearchIcon />
 * </Button>
 *
 * // As a link using asChild
 * <Button asChild>
 *   <a href="/dashboard">Dashboard</a>
 * </Button>
 * ```
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const classes = cn(buttonVariants({ variant, size, className }));

    // When asChild is true, use Slot to merge props onto child
    if (asChild) {
      return <Slot ref={ref} className={classes} {...props} />;
    }

    // Create motion-enhanced button props
    const motionProps: HTMLMotionProps<"button"> = {
      ref,
      className: classes,
      variants: motionVariants,
      initial: "initial",
      whileHover: props.disabled ? undefined : "hover",
      whileTap: props.disabled ? undefined : "tap",
      transition: motionTransition,
      ...props,
    };

    return <motion.button {...motionProps} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
