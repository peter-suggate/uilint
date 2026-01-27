/**
 * Input - shadcn-style input component with motion animations
 *
 * Features:
 * - CVA-based variant system (default, glass, error)
 * - Size variants (sm, default, lg)
 * - Focus ring animation using motion/react
 * - Icon slot support (left icon)
 * - Uses uilint design system CSS variables
 */
import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const inputVariants = cva(
  // Base styles using CSS variables
  [
    "flex w-full transition-colors",
    "file:border-0 file:bg-transparent file:text-sm file:font-medium",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "placeholder:text-[var(--uilint-input-placeholder)]",
    "outline-none",
  ],
  {
    variants: {
      variant: {
        default: [
          "bg-[var(--uilint-input-bg)]",
          "border border-[var(--uilint-input-border)]",
          "text-[var(--uilint-text-primary)]",
          "focus:border-[var(--uilint-input-border-focus)]",
        ],
        glass: [
          "bg-[var(--uilint-glass-medium)]",
          "backdrop-blur-[var(--uilint-glass-blur-medium)]",
          "border border-[var(--uilint-glass-border)]",
          "text-[var(--uilint-text-primary)]",
          "focus:border-[var(--uilint-input-border-focus)]",
        ],
        error: [
          "bg-[var(--uilint-input-bg)]",
          "border border-[var(--uilint-error)]",
          "text-[var(--uilint-text-primary)]",
          "focus:border-[var(--uilint-error)]",
        ],
      },
      size: {
        sm: "h-8 px-2.5 text-xs rounded-[calc(var(--uilint-input-radius)-2px)]",
        default: "h-10 px-3 text-sm rounded-[var(--uilint-input-radius)]",
        lg: "h-12 px-4 text-base rounded-[calc(var(--uilint-input-radius)+2px)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
  /**
   * Icon element to display on the left side of the input
   */
  icon?: React.ReactNode;
  /**
   * Container className for the wrapper div (when icon is present)
   */
  containerClassName?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      containerClassName,
      variant,
      size,
      type = "text",
      icon,
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = React.useState(false);

    const handleFocus = React.useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(true);
        onFocus?.(e);
      },
      [onFocus]
    );

    const handleBlur = React.useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(false);
        onBlur?.(e);
      },
      [onBlur]
    );

    // Get ring color based on variant
    const ringColor =
      variant === "error"
        ? "var(--uilint-error)"
        : "var(--uilint-input-ring)";

    // Base input element
    const inputElement = (
      <input
        type={type}
        className={cn(
          inputVariants({ variant, size }),
          icon && "pl-9",
          className
        )}
        ref={ref}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
    );

    // If no icon, render simple wrapper with focus ring animation
    if (!icon) {
      return (
        <div className={cn("relative", containerClassName)}>
          {inputElement}
          <AnimatePresence>
            {isFocused && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="pointer-events-none absolute inset-0 rounded-[var(--uilint-input-radius)]"
                style={{
                  boxShadow: `0 0 0 3px ${ringColor}`,
                }}
              />
            )}
          </AnimatePresence>
        </div>
      );
    }

    // With icon, wrap in container
    return (
      <div className={cn("relative", containerClassName)}>
        {/* Icon container */}
        <motion.div
          animate={{
            color: isFocused
              ? "var(--uilint-accent)"
              : "var(--uilint-text-muted)",
          }}
          transition={{ duration: 0.15 }}
          className={cn(
            "pointer-events-none absolute left-3 flex items-center justify-center",
            size === "sm" && "top-2",
            size === "default" && "top-2.5",
            size === "lg" && "top-3"
          )}
        >
          {icon}
        </motion.div>

        {inputElement}

        {/* Animated focus ring */}
        <AnimatePresence>
          {isFocused && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className={cn(
                "pointer-events-none absolute inset-0",
                size === "sm" && "rounded-[calc(var(--uilint-input-radius)-2px)]",
                size === "default" && "rounded-[var(--uilint-input-radius)]",
                size === "lg" && "rounded-[calc(var(--uilint-input-radius)+2px)]"
              )}
              style={{
                boxShadow: `0 0 0 3px ${ringColor}`,
              }}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input, inputVariants };
