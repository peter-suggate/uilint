/**
 * Accordion - shadcn-style Radix Accordion wrapper
 *
 * Thin wrapper around @radix-ui/react-accordion with CSS-animated expand/collapse.
 * Uses grid-template-rows animation for smooth height transitions.
 */
import React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { cn } from "../../lib/utils";

const AccordionRoot = AccordionPrimitive.Root;

const AccordionItem = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item ref={ref} className={cn(className)} {...props} />
));
AccordionItem.displayName = "AccordionItem";

const AccordionTrigger = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex-1 text-left transition-colors duration-75",
        "outline-none focus-visible:ring-1 focus-visible:ring-foreground/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm",
        className
      )}
      {...props}
    >
      {children}
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
AccordionTrigger.displayName = "AccordionTrigger";

const AccordionContent = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className={cn(
      "overflow-hidden",
      "data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down",
      className
    )}
    {...props}
  >
    {children}
  </AccordionPrimitive.Content>
));
AccordionContent.displayName = "AccordionContent";

export { AccordionRoot, AccordionItem, AccordionTrigger, AccordionContent };
