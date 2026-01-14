/**
 * Installer registry - central registration point for all installers
 *
 * Installers self-register here to be available in the install flow.
 */

import type { Installer } from "./types.js";

/**
 * Global registry of all installers
 */
const installers: Installer[] = [];

/**
 * Register an installer
 * @param installer - Installer to register
 */
export function registerInstaller(installer: Installer): void {
  // Prevent duplicate registrations
  if (installers.some((i) => i.id === installer.id)) {
    console.warn(`Installer "${installer.id}" is already registered`);
    return;
  }
  installers.push(installer);
}

/**
 * Get all registered installers
 * @returns Array of all installers
 */
export function getAllInstallers(): readonly Installer[] {
  return installers;
}

/**
 * Get installer by ID
 * @param id - Installer ID
 * @returns Installer or undefined if not found
 */
export function getInstallerById(id: string): Installer | undefined {
  return installers.find((i) => i.id === id);
}

/**
 * Clear all registered installers (for testing)
 */
export function clearInstallers(): void {
  installers.length = 0;
}
