// Circular dependency: a imports b
import { funcB } from "./b";

export function funcA() {
  return "A: " + funcB();
}
