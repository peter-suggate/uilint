// Circular dependency: b imports a
import { funcA } from "./a";

export function funcB() {
  return "B: " + funcA();
}
