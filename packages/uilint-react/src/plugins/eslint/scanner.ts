/**
 * ESLint Plugin Scanner Utilities
 *
 * Utilities for extracting file paths from dataLoc attributes
 * and managing lint request deduplication.
 */

/**
 * Parse a dataLoc string to extract the file path.
 *
 * DataLoc format: "path/to/file.tsx:line:column"
 * Examples:
 * - "app/page.tsx:10:5" → "app/page.tsx"
 * - "src/components/Button.tsx:42:8" → "src/components/Button.tsx"
 * - "/home/user/project/src/App.tsx:10:5" → "/home/user/project/src/App.tsx"
 *
 * @param dataLoc - The dataLoc string to parse
 * @returns The file path, or null if the format is invalid
 */
export function parseFilePathFromDataLoc(dataLoc: string): string | null {
  if (!dataLoc) {
    return null;
  }

  // DataLoc format: "path:line:column"
  // We need to find the last two colons that separate line:column
  // and extract everything before them as the file path

  // Find the last colon (separates column)
  const lastColonIndex = dataLoc.lastIndexOf(":");
  if (lastColonIndex === -1) {
    return null;
  }

  // Find the second-to-last colon (separates line)
  const secondLastColonIndex = dataLoc.lastIndexOf(":", lastColonIndex - 1);
  if (secondLastColonIndex === -1) {
    return null;
  }

  // Extract the file path (everything before the line number)
  const filePath = dataLoc.substring(0, secondLastColonIndex);

  if (!filePath) {
    return null;
  }

  return filePath;
}

/**
 * Extract unique file paths from an array of dataLoc strings.
 *
 * This deduplicates file paths so we only lint each file once,
 * even if multiple elements on the page come from the same file.
 *
 * @param dataLocs - Array of dataLoc strings
 * @returns Set of unique file paths
 */
export function extractUniqueFilePaths(dataLocs: string[]): Set<string> {
  const filePaths = new Set<string>();

  for (const dataLoc of dataLocs) {
    const filePath = parseFilePathFromDataLoc(dataLoc);
    if (filePath) {
      filePaths.add(filePath);
    }
  }

  return filePaths;
}
