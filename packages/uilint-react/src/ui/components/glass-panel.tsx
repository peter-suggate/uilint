/**
 * GlassPanel - Glassmorphism container component
 *
 * A shadcn-style component for glass morphism UI panels.
 * Used as the base container for CommandPalette, modals, etc.
 *
 * Features:
 * - CSS variable theming (--uilint-glass-*)
 * - Blur intensity variants (light, medium, heavy)
 * - Shadow variants (none, sm, md, lg)
 * - Optional border styling
 * - Scale + fade entrance/exit animations via motion/react
 * - Fully typed with HTMLDivElement attribute support
 */
import * as React from "react";
import { motion, AnimatePresence, type HTMLMotionProps } from "motion/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

/**
 * GlassPanel variants using CVA for consistent styling
 */
const glassPanelVariants = cva(
  // Base styles
  [
    "relative",
    "overflow-hidden",
    "rounded-[var(--uilint-radius,12px)]",
  ].join(" "),
  {
    variants: {
      blur: {
        light: "",
        medium: "",
        heavy: "",
      },
      shadow: {
        none: "",
        sm: "",
        md: "",
        lg: "",
      },
      bordered: {
        true: "",
        false: "",
      },
    },
    defaultVariants: {
      blur: "medium",
      shadow: "md",
      bordered: true,
    },
  }
);

/**
 * Motion variants for entrance/exit animations
 */
const glassPanelMotionVariants = {
  hidden: {
    opacity: 0,
    scale: 0.96,
    y: -10,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: -5,
  },
} as const;

/**
 * Default transition settings for smooth animations
 */
const defaultTransition = {
  duration: 0.2,
  ease: [0.25, 0.1, 0.25, 1], // cubic-bezier for smooth deceleration
} as const;

export interface GlassPanelProps
  extends Omit<HTMLMotionProps<"div">, "children">,
    VariantProps<typeof glassPanelVariants> {
  /** Content to render inside the panel */
  children: React.ReactNode;
  /** Whether to animate the component on mount/unmount */
  animate?: boolean;
  /** Custom animation transition settings */
  transition?: typeof defaultTransition;
  /** Whether to show the panel (controls AnimatePresence) */
  show?: boolean;
  /** Use AnimatePresence for exit animations (requires show prop) */
  usePresence?: boolean;
}

/**
 * Build inline styles for glass effect using CSS variables
 * This ensures proper backdrop-filter support and CSS variable fallbacks
 */
function getGlassStyles(
  blur: "light" | "medium" | "heavy" | null | undefined,
  shadow: "none" | "sm" | "md" | "lg" | null | undefined,
  bordered: boolean | null | undefined,
  customStyle?: React.CSSProperties
): React.CSSProperties {
  // Blur values mapping to CSS variables with fallbacks - increased for more frosted effect
  const blurValues = {
    light: "var(--uilint-glass-blur-light, 12px)",
    medium: "var(--uilint-glass-blur-medium, 24px)",
    heavy: "var(--uilint-glass-blur-heavy, 40px)",
  };

  // Background values - more transparent for cleaner look
  const backgroundValues = {
    light: "var(--uilint-glass-light, rgba(255, 255, 255, 0.4))",
    medium: "var(--uilint-glass-medium, rgba(255, 255, 255, 0.55))",
    heavy: "var(--uilint-glass-heavy, rgba(255, 255, 255, 0.7))",
  };

  // Shadow values - softer, more diffused shadows
  const shadowValues = {
    none: "none",
    sm: "var(--uilint-card-shadow, 0 2px 8px rgba(0, 0, 0, 0.03))",
    md: "var(--uilint-shadow, 0 8px 32px rgba(0, 0, 0, 0.06))",
    lg: "var(--uilint-shadow-lg, 0 16px 48px rgba(0, 0, 0, 0.08))",
  };

  const blurKey = blur ?? "medium";
  const shadowKey = shadow ?? "md";
  const blurValue = blurValues[blurKey];
  const shadowValue = shadowValues[shadowKey];
  const backgroundValue = backgroundValues[blurKey];

  // Build box-shadow - more subtle inset highlights
  const boxShadowParts: string[] = [];

  // Subtle inset highlight for glass effect (top edge shine)
  boxShadowParts.push("inset 0 1px 0 0 var(--uilint-glass-highlight, rgba(255, 255, 255, 0.25))");

  // Add external shadow
  if (shadowValue !== "none") {
    boxShadowParts.push(shadowValue);
  }

  return {
    background: backgroundValue,
    backdropFilter: `blur(${blurValue}) saturate(150%)`,
    WebkitBackdropFilter: `blur(${blurValue}) saturate(150%)`,
    boxShadow: boxShadowParts.join(", "),
    border: bordered !== false
      ? "1px solid var(--uilint-glass-border, rgba(255, 255, 255, 0.15))"
      : "none",
    ...customStyle,
  };
}

/**
 * GlassPanel component - Renders a glassmorphism container
 *
 * @example
 * ```tsx
 * // Basic usage
 * <GlassPanel>
 *   <p>Content goes here</p>
 * </GlassPanel>
 *
 * // With blur intensity variants
 * <GlassPanel blur="light">Light blur</GlassPanel>
 * <GlassPanel blur="medium">Medium blur</GlassPanel>
 * <GlassPanel blur="heavy">Heavy blur</GlassPanel>
 *
 * // With shadow variants
 * <GlassPanel shadow="none">No shadow</GlassPanel>
 * <GlassPanel shadow="sm">Small shadow</GlassPanel>
 * <GlassPanel shadow="lg">Large shadow</GlassPanel>
 *
 * // Without border
 * <GlassPanel bordered={false}>Borderless panel</GlassPanel>
 *
 * // With entrance/exit animations using AnimatePresence
 * <GlassPanel show={isVisible} usePresence>
 *   <p>Animated content</p>
 * </GlassPanel>
 *
 * // Without animation
 * <GlassPanel animate={false}>
 *   <p>Static content</p>
 * </GlassPanel>
 *
 * // CommandPalette-style usage
 * <GlassPanel
 *   blur="heavy"
 *   shadow="lg"
 *   className="w-full max-w-[580px]"
 * >
 *   <SearchInput />
 *   <ResultsList />
 * </GlassPanel>
 * ```
 */
const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  (
    {
      className,
      blur,
      shadow,
      bordered,
      children,
      animate = true,
      transition = defaultTransition,
      show = true,
      usePresence = false,
      style,
      ...props
    },
    ref
  ) => {
    const glassStyles = getGlassStyles(blur, shadow, bordered, style as React.CSSProperties | undefined);
    const variantClasses = glassPanelVariants({ blur, shadow, bordered });

    // Render with AnimatePresence for controlled show/hide with exit animations
    if (usePresence) {
      return (
        <AnimatePresence>
          {show && (
            <motion.div
              ref={ref}
              className={cn(variantClasses, className)}
              style={glassStyles}
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={glassPanelMotionVariants}
              transition={transition}
              {...props}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      );
    }

    // Render with entrance animation only
    if (animate) {
      return (
        <motion.div
          ref={ref}
          className={cn(variantClasses, className)}
          style={glassStyles}
          initial="hidden"
          animate="visible"
          variants={glassPanelMotionVariants}
          transition={transition}
          {...props}
        >
          {children}
        </motion.div>
      );
    }

    // Render without animation
    return (
      <motion.div
        ref={ref}
        className={cn(variantClasses, className)}
        style={glassStyles}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

GlassPanel.displayName = "GlassPanel";

export {
  GlassPanel,
  glassPanelVariants,
  glassPanelMotionVariants,
  defaultTransition as glassPanelTransition,
  getGlassStyles,
};
