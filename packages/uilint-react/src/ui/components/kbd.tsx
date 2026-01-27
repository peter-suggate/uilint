/**
 * Kbd - macOS-style keyboard hint component
 *
 * A shadcn-style component for displaying keyboard shortcuts and hints.
 * Inspired by Spotlight/Raycast keyboard hints with smooth animations.
 *
 * Features:
 * - CSS variable theming (--uilint-kbd-*)
 * - Fade-in animation via motion/react
 * - Size and variant options via CVA
 */
import * as React from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

/**
 * Kbd variants using CVA for consistent styling
 */
const kbdVariants = cva(
  // Base styles
  [
    "inline-flex items-center justify-center",
    "font-medium",
    "font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text','Segoe_UI',sans-serif]",
    "rounded",
    "select-none",
    "whitespace-nowrap",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          // Use CSS variables with fallbacks to the inline styles from existing implementations
          "bg-[var(--uilint-kbd-background,linear-gradient(180deg,#ffffff_0%,#f3f4f6_100%))]",
          "text-[var(--uilint-kbd-text,#6b7280)]",
          "border border-[var(--uilint-kbd-border,rgba(0,0,0,0.1))]",
          "shadow-[var(--uilint-kbd-shadow,0_1px_0_rgba(0,0,0,0.08))]",
        ].join(" "),
        subtle: [
          "bg-[var(--uilint-kbd-background-subtle,rgba(0,0,0,0.04))]",
          "text-[var(--uilint-kbd-text-subtle,#9ca3af)]",
          "border border-[var(--uilint-kbd-border-subtle,transparent)]",
        ].join(" "),
      },
      size: {
        sm: "min-w-4 h-4 px-1 text-[9px]",
        default: "min-w-[18px] h-[18px] px-1 text-[10px]",
        lg: "min-w-6 h-6 px-1.5 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

/**
 * Motion variants for fade-in animation
 */
const kbdMotionVariants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    scale: 1,
  },
} as const;

export interface KbdProps
  extends Omit<HTMLMotionProps<"kbd">, "children">,
    VariantProps<typeof kbdVariants> {
  /** The keyboard key or shortcut to display */
  children: React.ReactNode;
  /** Whether to animate the component on mount */
  animate?: boolean;
  /** Animation duration in seconds */
  animationDuration?: number;
}

/**
 * Kbd component - Renders a keyboard hint with macOS-style appearance
 *
 * @example
 * ```tsx
 * // Basic usage
 * <Kbd>esc</Kbd>
 * <Kbd>Enter</Kbd>
 *
 * // With modifier keys
 * <Kbd>⌘K</Kbd>
 * <Kbd>Ctrl+S</Kbd>
 *
 * // Variants
 * <Kbd variant="subtle">Tab</Kbd>
 *
 * // Sizes
 * <Kbd size="sm">↑</Kbd>
 * <Kbd size="lg">Space</Kbd>
 *
 * // With animation disabled
 * <Kbd animate={false}>F1</Kbd>
 * ```
 */
const Kbd = React.forwardRef<HTMLElement, KbdProps>(
  (
    {
      className,
      variant,
      size,
      children,
      animate = true,
      animationDuration = 0.1,
      style,
      ...props
    },
    ref
  ) => {
    // Inline style fallbacks for CSS variable support
    // These ensure the component works even without CSS variables defined
    const baseStyles = {
      // Gradient background needs inline style as Tailwind can't do gradient vars easily
      background:
        variant === "subtle"
          ? "var(--uilint-kbd-background-subtle, rgba(0, 0, 0, 0.04))"
          : "var(--uilint-kbd-background, linear-gradient(180deg, #ffffff 0%, #f3f4f6 100%))",
      color:
        variant === "subtle"
          ? "var(--uilint-kbd-text-subtle, #9ca3af)"
          : "var(--uilint-kbd-text, #6b7280)",
      borderColor:
        variant === "subtle"
          ? "var(--uilint-kbd-border-subtle, transparent)"
          : "var(--uilint-kbd-border, rgba(0, 0, 0, 0.1))",
      boxShadow:
        variant === "subtle"
          ? "none"
          : "var(--uilint-kbd-shadow, 0 1px 0 rgba(0, 0, 0, 0.08))",
      ...style,
    } as const;

    if (animate) {
      return (
        <motion.kbd
          ref={ref as React.Ref<HTMLElement>}
          className={cn(kbdVariants({ variant, size }), className)}
          style={baseStyles}
          initial="hidden"
          animate="visible"
          variants={kbdMotionVariants}
          transition={{ duration: animationDuration, ease: "easeOut" }}
          {...props}
        >
          {children}
        </motion.kbd>
      );
    }

    return (
      <motion.kbd
        ref={ref as React.Ref<HTMLElement>}
        className={cn(kbdVariants({ variant, size }), className)}
        style={baseStyles}
        {...props}
      >
        {children}
      </motion.kbd>
    );
  }
);

Kbd.displayName = "Kbd";

export { Kbd, kbdVariants, kbdMotionVariants };
