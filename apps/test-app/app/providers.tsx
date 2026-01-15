"use client";

import React from "react";
import "uilint-react/devtools";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <uilint-devtools />
    </>
  );
}
