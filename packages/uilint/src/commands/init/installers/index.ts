/**
 * Installer registry - auto-registration of all installers
 */

import { registerInstaller } from "./registry.js";
import { genstyleguideInstaller } from "./genstyleguide.js";
import { skillInstaller } from "./skill.js";
import { eslintInstaller } from "./eslint.js";
import { nextOverlayInstaller } from "./next-overlay.js";
import { viteOverlayInstaller } from "./vite-overlay.js";

// Export types
export * from "./types.js";
export * from "./registry.js";

// Export individual installers
export { genstyleguideInstaller } from "./genstyleguide.js";
export { skillInstaller } from "./skill.js";
export { eslintInstaller } from "./eslint.js";
export { nextOverlayInstaller } from "./next-overlay.js";
export { viteOverlayInstaller } from "./vite-overlay.js";

// Export AI hooks utilities
export * from "./ai-hooks.js";

// Auto-register all installers
registerInstaller(genstyleguideInstaller);
registerInstaller(skillInstaller);
registerInstaller(eslintInstaller);
registerInstaller(nextOverlayInstaller);
registerInstaller(viteOverlayInstaller);
