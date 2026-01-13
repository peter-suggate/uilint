import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "dt:inline-flex dt:items-center dt:justify-center dt:gap-2 dt:whitespace-nowrap dt:rounded-md dt:text-sm dt:font-medium dt:ring-offset-white dt:transition-colors dt:focus-visible:outline-none dt:focus-visible:ring-2 dt:focus-visible:ring-zinc-950 dt:focus-visible:ring-offset-2 dt:disabled:pointer-events-none dt:disabled:opacity-50 dt:[&_svg]:pointer-events-none dt:[&_svg]:size-4 dt:[&_svg]:shrink-0 dt:dark:ring-offset-zinc-950 dt:dark:focus-visible:ring-zinc-300",
  {
    variants: {
      variant: {
        default: "dt:bg-zinc-900 dt:text-zinc-50 dt:hover:bg-zinc-900/90 dt:dark:bg-zinc-50 dt:dark:text-zinc-900 dt:dark:hover:bg-zinc-50/90",
        destructive:
          "dt:bg-red-500 dt:text-zinc-50 dt:hover:bg-red-500/90 dt:dark:bg-red-900 dt:dark:text-zinc-50 dt:dark:hover:bg-red-900/90",
        outline:
          "dt:border dt:border-zinc-200 dt:bg-white dt:hover:bg-zinc-100 dt:hover:text-zinc-900 dt:dark:border-zinc-800 dt:dark:bg-zinc-950 dt:dark:hover:bg-zinc-800 dt:dark:hover:text-zinc-50",
        secondary:
          "dt:bg-zinc-100 dt:text-zinc-900 dt:hover:bg-zinc-100/80 dt:dark:bg-zinc-800 dt:dark:text-zinc-50 dt:dark:hover:bg-zinc-800/80",
        ghost: "dt:hover:bg-zinc-100 dt:hover:text-zinc-900 dt:dark:hover:bg-zinc-800 dt:dark:hover:text-zinc-50",
        link: "dt:text-zinc-900 dt:underline-offset-4 dt:hover:underline dt:dark:text-zinc-50",
      },
      size: {
        default: "dt:h-10 dt:px-4 dt:py-2",
        sm: "dt:h-9 dt:rounded-md dt:px-3",
        lg: "dt:h-11 dt:rounded-md dt:px-8",
        icon: "dt:h-10 dt:w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
