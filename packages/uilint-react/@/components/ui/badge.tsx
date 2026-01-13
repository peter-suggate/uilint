import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 dark:focus:ring-zinc-300",
  {
    variants: {
      variant: {
        default:
          "border border-transparent bg-zinc-900 text-zinc-50 hover:bg-zinc-900/80 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-50/80",
        secondary:
          "border border-transparent bg-zinc-100 text-zinc-900 hover:bg-zinc-100/80 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-800/80",
        destructive:
          "border border-transparent bg-red-500 text-zinc-50 hover:bg-red-500/80 dark:bg-red-900 dark:text-zinc-50 dark:hover:bg-red-900/80",
        outline:
          "border border-zinc-200 text-zinc-950 dark:border-zinc-800 dark:text-zinc-50",
        // Issue count variants - high contrast for visibility
        success:
          "border-0 bg-emerald-500/20 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-300 font-bold",
        warning:
          "border-0 bg-amber-500/20 text-amber-700 dark:bg-amber-500/25 dark:text-amber-300 font-bold",
        error:
          "border-0 bg-red-500/20 text-red-700 dark:bg-red-500/25 dark:text-red-300 font-bold",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs h-5",
        sm: "px-1.5 py-0 text-[10px] h-4 min-w-4",
        lg: "px-3 py-1 text-sm h-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}

/**
 * Issue count badge - convenience component for displaying issue counts
 * Automatically chooses variant based on count: 0 = success, > 0 = warning
 */
interface IssueCountBadgeProps {
  count: number;
  className?: string;
  size?: "default" | "sm" | "lg";
  /** Force error variant regardless of count */
  error?: boolean;
}

function IssueCountBadge({
  count,
  className,
  size = "sm",
  error = false,
}: IssueCountBadgeProps) {
  const variant = error ? "error" : count === 0 ? "success" : "warning";

  return (
    <Badge variant={variant} size={size} className={cn("font-mono", className)}>
      {count}
    </Badge>
  );
}

export { Badge, IssueCountBadge, badgeVariants };
