// Consumer that imports from index (re-export)
import { Button } from "./index";

export function Page() {
  return <Button onClick={() => console.log("clicked")}>Click me</Button>;
}
