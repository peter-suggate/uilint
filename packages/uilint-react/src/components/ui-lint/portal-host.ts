export const DEVTOOL_ROOT_CLASS = "dev-tool-root";

export function getUILintPortalHost(): HTMLElement {
  if (typeof document === "undefined") {
    throw new Error("getUILintPortalHost() called outside of a DOM environment");
  }

  const root = document.querySelector<HTMLElement>(`.${DEVTOOL_ROOT_CLASS}`);
  return root ?? document.body;
}
