/**
 * Card Component System
 *
 * A composable card component following shadcn conventions.
 * Supports multiple variants: default, elevated, and glass (glassmorphism).
 * Includes motion animations for interactive states.
 */
import * as React from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils";

/* -----------------------------------------------------------------------------
 * Card Variants (CVA)
 * -------------------------------------------------------------------------- */

const cardVariants = cva(
  // Base styles using CSS variables
  [
    "relative",
    "flex",
    "flex-col",
    "overflow-hidden",
    "transition-all",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          // Default card styling
          "[background:var(--uilint-card-bg)]",
          "[border:1px_solid_var(--uilint-card-border)]",
          "[border-radius:var(--uilint-card-radius)]",
          "[box-shadow:var(--uilint-card-shadow)]",
        ].join(" "),
        elevated: [
          // Elevated card with stronger shadow
          "[background:var(--uilint-card-elevated-bg)]",
          "[border:1px_solid_var(--uilint-card-border)]",
          "[border-radius:var(--uilint-card-radius)]",
          "[box-shadow:var(--uilint-card-elevated-shadow)]",
        ].join(" "),
        glass: [
          // Glassmorphism effect
          "[background:var(--uilint-card-glass-bg)]",
          "[border:1px_solid_var(--uilint-card-glass-border)]",
          "[border-radius:var(--uilint-card-radius)]",
          "[backdrop-filter:blur(var(--uilint-glass-blur-medium))]",
          "[box-shadow:var(--uilint-card-shadow)]",
          // Subtle top highlight for glass effect
          "before:absolute",
          "before:inset-x-0",
          "before:top-0",
          "before:h-px",
          "before:[background:var(--uilint-glass-highlight)]",
        ].join(" "),
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

/* -----------------------------------------------------------------------------
 * Motion Animation Variants
 * -------------------------------------------------------------------------- */

const fadeInVariants = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 4 },
};

const hoverLiftVariants = {
  rest: {
    y: 0,
    boxShadow: "var(--uilint-card-shadow)",
  },
  hover: {
    y: -2,
    boxShadow: "var(--uilint-card-shadow-hover)",
  },
};

const transitionConfig = {
  duration: 0.15,
  ease: [0.32, 0.72, 0, 1] as const, // Crisp easing
};

/* -----------------------------------------------------------------------------
 * Card Types
 * -------------------------------------------------------------------------- */

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  /** Enable interactive hover effects (lift animation) */
  interactive?: boolean;
  /** Enable motion animations */
  animated?: boolean;
  /** Render as a different element using motion component */
  asChild?: boolean;
}

/* -----------------------------------------------------------------------------
 * Card Component
 * -------------------------------------------------------------------------- */

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      variant,
      interactive = false,
      animated = false,
      children,
      ...props
    },
    ref
  ) => {
    // Use motion div for interactive or animated cards
    if (interactive || animated) {
      return (
        <motion.div
          ref={ref}
          className={cn(
            cardVariants({ variant }),
            interactive && "cursor-pointer",
            className
          )}
          variants={interactive ? hoverLiftVariants : undefined}
          initial={animated ? fadeInVariants.initial : "rest"}
          animate={animated ? fadeInVariants.animate : "rest"}
          exit={animated ? fadeInVariants.exit : undefined}
          whileHover={interactive ? "hover" : undefined}
          transition={transitionConfig}
          {...(props as HTMLMotionProps<"div">)}
        >
          {children}
        </motion.div>
      );
    }

    // Static card without motion
    return (
      <div
        ref={ref}
        className={cn(cardVariants({ variant }), className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";

/* -----------------------------------------------------------------------------
 * CardHeader Component
 * -------------------------------------------------------------------------- */

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  )
);
CardHeader.displayName = "CardHeader";

/* -----------------------------------------------------------------------------
 * CardTitle Component
 * -------------------------------------------------------------------------- */

export interface CardTitleProps
  extends React.HTMLAttributes<HTMLHeadingElement> {}

const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn(
        "text-base font-semibold leading-tight tracking-tight",
        "[color:var(--uilint-text-primary)]",
        className
      )}
      {...props}
    />
  )
);
CardTitle.displayName = "CardTitle";

/* -----------------------------------------------------------------------------
 * CardDescription Component
 * -------------------------------------------------------------------------- */

export interface CardDescriptionProps
  extends React.HTMLAttributes<HTMLParagraphElement> {}

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  CardDescriptionProps
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      "text-sm leading-relaxed",
      "[color:var(--uilint-text-secondary)]",
      className
    )}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

/* -----------------------------------------------------------------------------
 * CardContent Component
 * -------------------------------------------------------------------------- */

export interface CardContentProps
  extends React.HTMLAttributes<HTMLDivElement> {}

const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-4 pt-0", className)} {...props} />
  )
);
CardContent.displayName = "CardContent";

/* -----------------------------------------------------------------------------
 * CardFooter Component
 * -------------------------------------------------------------------------- */

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center gap-2 p-4 pt-0",
        "[border-top:1px_solid_var(--uilint-card-border)]",
        "mt-auto",
        className
      )}
      {...props}
    />
  )
);
CardFooter.displayName = "CardFooter";

/* -----------------------------------------------------------------------------
 * Exports
 * -------------------------------------------------------------------------- */

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  cardVariants,
};
