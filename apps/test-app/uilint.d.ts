/**
 * Type declarations for the <uilint-devtools> custom element.
 */

import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements {
        "uilint-devtools": DetailedHTMLProps<
          HTMLAttributes<HTMLElement> & {
            enabled?: string;
            position?:
              | "bottom-left"
              | "bottom-right"
              | "top-left"
              | "top-right";
            theme?: "light" | "dark" | "system";
          },
          HTMLElement
        >;
      }
    }
  }
}

export {};
