// Component that imports both external (react) and local
import React from "react";
import { helper } from "./local";

export function MyComponent() {
  return <div>{helper()}</div>;
}
