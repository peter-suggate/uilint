/**
 * Type declarations for the <uilint-devtools> custom element.
 *
 * This extends React.JSX.IntrinsicElements to allow using the web component in TSX.
 * Works with React 19 and Next.js.
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
