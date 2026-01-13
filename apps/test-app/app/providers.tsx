"use client";

import React from "react";
import { UILintProvider } from "uilint-react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <UILintProvider enabled={process.env.NODE_ENV !== "production"}>
      {children}
    </UILintProvider>
  );
}
