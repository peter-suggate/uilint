/**
 * Webpack/Turbopack loader that transforms JSX to add data-loc attributes
 */

import { shouldProcessFile, transformJsxCode } from "./transform";
import fs from "fs";

interface LoaderContext {
  async(): (err: Error | null, content?: string, map?: any) => void;
  resourcePath: string;
}

/**
 * Check if a path is a file (not a directory)
 * This is needed because Turbopack may pass directory paths
 */
function isFile(filePath: string): boolean {
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile();
  } catch {
    // If we can't stat the file, assume it's not a file
    return false;
  }
}

async function jsxLocLoader(this: LoaderContext, source: string) {
  const callback = this.async();

  console.log(`[jsx-loc-plugin] Processing: ${this.resourcePath}`);

  // Skip directories (Turbopack bug workaround)
  if (!isFile(this.resourcePath)) {
    console.log(`[jsx-loc-plugin] Skipping (not a file): ${this.resourcePath}`);
    return callback(null, source);
  }

  if (!shouldProcessFile(this.resourcePath)) {
    console.log(
      `[jsx-loc-plugin] Skipping (shouldProcessFile=false): ${this.resourcePath}`
    );
    return callback(null, source);
  }

  try {
    console.log(`[jsx-loc-plugin] resourcePath: ${this.resourcePath}`);
    const result = transformJsxCode(source, this.resourcePath);
    if (!result) {
      console.log(
        `[jsx-loc-plugin] No transform result for: ${this.resourcePath}`
      );
      return callback(null, source);
    }
    console.log(`[jsx-loc-plugin] Transformed: ${this.resourcePath}`);
    callback(null, result.code, result.map);
  } catch (error) {
    console.error(
      `[jsx-loc-plugin] Error processing file ${this.resourcePath}:`,
      error
    );
    callback(null, source);
  }
}

export default jsxLocLoader;
