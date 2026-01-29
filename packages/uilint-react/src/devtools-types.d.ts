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
              | "top-right"
              | "top-center"
              | "bottom-center";
            theme?: "light" | "dark" | "system";
            /**
             * Operating mode:
             * - "websocket": Connect to local uilint serve (default)
             * - "static": Load issues from pre-built manifest
             */
            mode?: "websocket" | "static";
            /**
             * URL to the lint manifest (required for mode="static")
             * Example: "/.uilint/manifest.json"
             */
            "manifest-url"?: string;
          },
          HTMLElement
        >;
      }
    }
  }
}

export {};
