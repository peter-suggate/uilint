/**
 * Import Graph Service
 *
 * Provides demand-driven cross-file analysis to detect UI library usage
 * across component trees. Uses in-memory caching for performance.
 */

import {
  resolveImportPath,
  resolveExport,
  clearResolverCaches,
} from "./export-resolver.js";
import {
  parseComponentBody,
  detectLibraryFromSource,
  type LibraryName,
  type ComponentStyleInfo,
} from "./component-parser.js";

/**
 * Information about a component's UI library usage
 */
export interface ComponentLibraryInfo {
  /** Direct library (from import source, e.g., "@mui/material" -> "mui") */
  library: LibraryName | null;
  /** Libraries used internally by this component (for local components) */
  internalLibraries: Set<LibraryName>;
  /** Evidence of which internal components caused the library detection */
  libraryEvidence: Array<{
    componentName: string;
    library: LibraryName;
  }>;
  /** Whether this is a local component (resolved from project files) */
  isLocalComponent: boolean;
}

/**
 * Cache for analyzed components: "filePath::componentName" -> ComponentLibraryInfo
 */
const componentLibraryCache = new Map<string, ComponentLibraryInfo>();

/**
 * Get a singleton instance of the import graph service
 */
export function getImportGraphService() {
  return {
    getComponentLibrary,
    clearCache,
  };
}

/**
 * Analyze a component's library usage, including transitive dependencies
 *
 * @param contextFilePath - The file where the component is used (for resolving relative imports)
 * @param componentName - The name of the component (e.g., "Button", "MyCard")
 * @param importSource - The import source (e.g., "@mui/material", "./components/cards")
 * @returns Library information including direct and transitive library usage
 */
export function getComponentLibrary(
  contextFilePath: string,
  componentName: string,
  importSource: string
): ComponentLibraryInfo {
  // Check if import source directly indicates a known library
  const directLibrary = detectLibraryFromSource(importSource);

  if (directLibrary) {
    // It's a direct import from a known library (e.g., @mui/material)
    return {
      library: directLibrary,
      internalLibraries: new Set(),
      libraryEvidence: [],
      isLocalComponent: false,
    };
  }

  // It's a local component - resolve and analyze it
  const resolvedPath = resolveImportPath(importSource, contextFilePath);

  if (!resolvedPath) {
    // Could not resolve - might be external or invalid
    return {
      library: null,
      internalLibraries: new Set(),
      libraryEvidence: [],
      isLocalComponent: false,
    };
  }

  // Check cache
  const cacheKey = `${resolvedPath}::${componentName}`;
  if (componentLibraryCache.has(cacheKey)) {
    return componentLibraryCache.get(cacheKey)!;
  }

  // Resolve re-exports to find the actual component definition
  const resolvedExport = resolveExport(componentName, resolvedPath);
  const actualFilePath = resolvedExport?.filePath ?? resolvedPath;
  const actualComponentName = resolvedExport?.localName ?? componentName;

  // Analyze the component body
  const result = analyzeComponentLibraries(
    actualFilePath,
    actualComponentName,
    new Set([cacheKey]) // Track visited to prevent cycles
  );

  componentLibraryCache.set(cacheKey, result);
  return result;
}

/**
 * Recursively analyze a component's library usage
 */
function analyzeComponentLibraries(
  filePath: string,
  componentName: string,
  visited: Set<string>
): ComponentLibraryInfo {
  const styleInfo = parseComponentBody(filePath, componentName);

  if (!styleInfo) {
    return {
      library: null,
      internalLibraries: new Set(),
      libraryEvidence: [],
      isLocalComponent: true,
    };
  }

  const internalLibraries = new Set<LibraryName>();
  const libraryEvidence: Array<{ componentName: string; library: LibraryName }> = [];

  // Check direct library usage within this component
  if (styleInfo.directLibrary) {
    internalLibraries.add(styleInfo.directLibrary);
  }

  // Analyze each used component
  for (const usedComponent of styleInfo.usedComponents) {
    const usedLibrary = detectLibraryFromSource(usedComponent.importSource);

    if (usedLibrary) {
      // Direct import from a known library
      internalLibraries.add(usedLibrary);
      libraryEvidence.push({
        componentName: usedComponent.name,
        library: usedLibrary,
      });
    } else {
      // It's a local component - recurse into it
      const resolvedPath = resolveImportPath(usedComponent.importSource, filePath);

      if (resolvedPath) {
        const cacheKey = `${resolvedPath}::${usedComponent.name}`;

        // Skip if already visited (cycle detection)
        if (!visited.has(cacheKey)) {
          visited.add(cacheKey);

          // Check cache first
          let nestedInfo: ComponentLibraryInfo;
          if (componentLibraryCache.has(cacheKey)) {
            nestedInfo = componentLibraryCache.get(cacheKey)!;
          } else {
            // Resolve re-exports
            const resolvedExport = resolveExport(usedComponent.name, resolvedPath);
            const actualFilePath = resolvedExport?.filePath ?? resolvedPath;
            const actualComponentName = resolvedExport?.localName ?? usedComponent.name;

            nestedInfo = analyzeComponentLibraries(
              actualFilePath,
              actualComponentName,
              visited
            );
            componentLibraryCache.set(cacheKey, nestedInfo);
          }

          // Aggregate the nested component's libraries
          if (nestedInfo.library) {
            internalLibraries.add(nestedInfo.library);
            libraryEvidence.push({
              componentName: usedComponent.name,
              library: nestedInfo.library,
            });
          }

          for (const lib of nestedInfo.internalLibraries) {
            internalLibraries.add(lib);
          }

          // Add evidence from nested components
          for (const evidence of nestedInfo.libraryEvidence) {
            libraryEvidence.push({
              componentName: `${usedComponent.name} → ${evidence.componentName}`,
              library: evidence.library,
            });
          }
        }
      }
    }
  }

  return {
    library: styleInfo.directLibrary,
    internalLibraries,
    libraryEvidence,
    isLocalComponent: true,
  };
}

/**
 * Clear all caches (useful for testing or between ESLint runs)
 */
export function clearCache(): void {
  componentLibraryCache.clear();
  clearResolverCaches();
}

// Re-export types for convenience
export type { LibraryName };
