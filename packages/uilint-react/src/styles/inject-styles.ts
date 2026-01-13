let injected = false;

export function injectDevToolStyles(cssText: string) {
  if (typeof document === "undefined") return;
  if (injected) return;

  const style = document.createElement("style");
  style.setAttribute("data-uilint-devtools-styles", "true");
  style.textContent = cssText;
  document.head.appendChild(style);

  injected = true;
}
