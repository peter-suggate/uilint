/**
 * UILint Primitives - shadcn-style UI components with glassmorphism
 *
 * This barrel export provides all primitive UI components for the UILint devtools.
 * Components use CSS variables from the design system and include motion animations.
 *
 * @example
 * import { Button, Card, Badge, GlassPanel } from './primitives';
 */

// Keyboard hint component
export { Kbd, kbdVariants, kbdMotionVariants } from "./kbd";
export type { KbdProps } from "./kbd";

// Badge components for status indicators
export {
  Badge,
  StatBadge,
  CategoryBadge,
  CountBadge,
  badgeVariants,
} from "./badge";
export type { BadgeProps, StatBadgeProps } from "./badge";

// Button component with variants
export { Button, buttonVariants } from "./button";
export type { ButtonProps } from "./button";

// Icon button for toolbar actions
export { IconButton, iconButtonVariants } from "./icon-button";
export type { IconButtonProps } from "./icon-button";

// Input component with icon slot
export { Input, inputVariants } from "./input";
export type { InputProps } from "./input";

// Card component system
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  cardVariants,
} from "./card";
export type {
  CardProps,
  CardHeaderProps,
  CardTitleProps,
  CardDescriptionProps,
  CardContentProps,
  CardFooterProps,
} from "./card";

// Glass panel container
export {
  GlassPanel,
  glassPanelVariants,
  glassPanelMotionVariants,
  glassPanelTransition,
  getGlassStyles,
} from "./glass-panel";
export type { GlassPanelProps } from "./glass-panel";
