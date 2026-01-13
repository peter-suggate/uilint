import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * `cn()` helper used across shadcn/cult components.
 *
 * Note: We scope Tailwind utilities to the devtool container via
 * `tailwind.config.ts` (`important: ".dev-tool-root"`), so we do NOT need a
 * custom class prefix. Keeping classnames standard also ensures Tailwind JIT
 * can see them and emit the right utilities into the injected CSS bundle.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
