/**
 * Coverage Aggregator
 *
 * Calculates weighted aggregate coverage for a component by tracing its
 * dependencies and combining their coverage using smart weighting.
 *
 * Weighting strategy:
 * - core (1.0): hooks, components, services - critical logic
 * - utility (0.5): formatters, validators - supporting code
 * - constant (0.25): config, constants - static data
 * - type (0): .d.ts, type-only - no runtime impact
 */

import { categorizeFile, type FileCategory } from "./file-categorizer";
import { buildDependencyGraph } from "./dependency-graph";

/**
 * Istanbul coverage JSON format (matching require-test-coverage.ts)
 */
export interface IstanbulCoverage {
  [filePath: string]: {
    path: string;
    statementMap: {
      [key: string]: {
        start: { line: number; column: number };
        end: { line: number; column: number };
      };
    };
    fnMap: {
      [key: string]: {
        name: string;
        decl: {
          start: { line: number; column: number };
          end: { line: number; column: number };
        };
        loc: {
          start: { line: number; column: number };
          end: { line: number; column: number };
        };
      };
    };
    branchMap: {
      [key: string]: {
        loc: {
          start: { line: number; column: number };
          end: { line: number; column: number };
        };
        type: string;
        locations: Array<{
          start: { line: number; column: number };
          end: { line: number; column: number };
        }>;
      };
    };
    s: { [key: string]: number }; // Statement hit counts
    f: { [key: string]: number }; // Function hit counts
    b: { [key: string]: number[] }; // Branch hit counts
  };
}

/**
 * Coverage information for a single file
 */
export interface FileCoverageInfo {
  filePath: string;
  category: FileCategory;
  weight: number;
  statements: { covered: number; total: number };
  percentage: number;
}

/**
 * Aggregated coverage result for a component
 */
export interface AggregatedCoverage {
  /** The component file that was analyzed */
  componentFile: string;
  /** Coverage percentage for just the component file */
  componentCoverage: number;
  /** Weighted aggregate coverage across component + all dependencies */
  aggregateCoverage: number;
  /** Total number of files analyzed (component + dependencies) */
  totalFiles: number;
  /** Detailed coverage info for each file */
  filesAnalyzed: FileCoverageInfo[];
  /** Files with 0% coverage */
  uncoveredFiles: string[];
  /** The file with lowest coverage (excluding 0% files) */
  lowestCoverageFile: { path: string; percentage: number } | null;
}

/**
 * Calculate aggregate coverage for a component and its dependencies
 *
 * @param componentFile - Absolute path to the component file
 * @param projectRoot - Project root directory
 * @param coverageData - Istanbul coverage data
 * @returns Aggregated coverage information
 */
export function aggregateCoverage(
  componentFile: string,
  projectRoot: string,
  coverageData: IstanbulCoverage
): AggregatedCoverage {
  // Build dependency graph
  const graph = buildDependencyGraph(componentFile, projectRoot);

  // Collect all files to analyze (component + dependencies)
  const allFiles = new Set<string>([componentFile, ...graph.allDependencies]);

  // Analyze each file
  const filesAnalyzed: FileCoverageInfo[] = [];
  const uncoveredFiles: string[] = [];
  let lowestCoverageFile: { path: string; percentage: number } | null = null;
  let componentCoverageInfo: FileCoverageInfo | null = null;

  for (const filePath of allFiles) {
    const coverageInfo = getFileCoverage(filePath, projectRoot, coverageData);
    filesAnalyzed.push(coverageInfo);

    // Track component coverage separately
    if (filePath === componentFile) {
      componentCoverageInfo = coverageInfo;
    }

    // Track uncovered files (0%)
    if (coverageInfo.percentage === 0 && coverageInfo.statements.total > 0) {
      uncoveredFiles.push(filePath);
    }

    // Track lowest coverage (excluding 0% and type files with weight 0)
    if (
      coverageInfo.percentage > 0 &&
      coverageInfo.weight > 0 &&
      coverageInfo.statements.total > 0
    ) {
      if (
        !lowestCoverageFile ||
        coverageInfo.percentage < lowestCoverageFile.percentage
      ) {
        lowestCoverageFile = {
          path: filePath,
          percentage: coverageInfo.percentage,
        };
      }
    }
  }

  // Calculate weighted aggregate coverage
  const aggregateCoverageValue = calculateWeightedCoverage(filesAnalyzed);

  return {
    componentFile,
    componentCoverage: componentCoverageInfo?.percentage ?? 0,
    aggregateCoverage: aggregateCoverageValue,
    totalFiles: filesAnalyzed.length,
    filesAnalyzed,
    uncoveredFiles,
    lowestCoverageFile,
  };
}

/**
 * Get coverage information for a single file
 */
function getFileCoverage(
  filePath: string,
  projectRoot: string,
  coverageData: IstanbulCoverage
): FileCoverageInfo {
  // Categorize the file
  const categoryResult = categorizeFile(filePath, projectRoot);

  // Find coverage data for this file
  const fileCoverage = findCoverageForFile(filePath, coverageData, projectRoot);

  if (!fileCoverage) {
    // No coverage data - could mean not tested or file not found
    return {
      filePath,
      category: categoryResult.category,
      weight: categoryResult.weight,
      statements: { covered: 0, total: 0 },
      percentage: 0,
    };
  }

  // Calculate statement coverage
  const statementHits = fileCoverage.s;
  const totalStatements = Object.keys(statementHits).length;
  const coveredStatements = Object.values(statementHits).filter(
    (hits) => hits > 0
  ).length;

  const percentage =
    totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 0;

  return {
    filePath,
    category: categoryResult.category,
    weight: categoryResult.weight,
    statements: { covered: coveredStatements, total: totalStatements },
    percentage: Math.round(percentage * 100) / 100, // Round to 2 decimal places
  };
}

/**
 * Find coverage data for a file, handling path normalization
 */
function findCoverageForFile(
  filePath: string,
  coverageData: IstanbulCoverage,
  projectRoot: string
): IstanbulCoverage[string] | null {
  // Try exact match first
  if (coverageData[filePath]) {
    return coverageData[filePath];
  }

  // Try relative path from project root
  const relativePath = filePath.startsWith(projectRoot)
    ? filePath.slice(projectRoot.length)
    : filePath;

  // Try with and without leading slash
  const pathVariants = [
    relativePath,
    relativePath.startsWith("/") ? relativePath.slice(1) : `/${relativePath}`,
    relativePath.startsWith("/") ? relativePath : `/${relativePath}`,
  ];

  for (const variant of pathVariants) {
    if (coverageData[variant]) {
      return coverageData[variant];
    }
  }

  // Try matching by checking if coverage path ends with relative path
  for (const [coveragePath, coverage] of Object.entries(coverageData)) {
    if (
      coveragePath.endsWith(relativePath) ||
      coveragePath.endsWith(relativePath.slice(1))
    ) {
      return coverage;
    }
  }

  return null;
}

/**
 * Calculate weighted average coverage across files
 *
 * Uses statement count * weight for each file to determine contribution.
 * Files with weight 0 (type files) are excluded from calculation.
 */
function calculateWeightedCoverage(files: FileCoverageInfo[]): number {
  let totalWeightedStatements = 0;
  let totalWeightedCovered = 0;

  for (const file of files) {
    // Skip files with weight 0 (type files)
    if (file.weight === 0) {
      continue;
    }

    // Skip files with no statements
    if (file.statements.total === 0) {
      continue;
    }

    const weightedTotal = file.statements.total * file.weight;
    const weightedCovered = file.statements.covered * file.weight;

    totalWeightedStatements += weightedTotal;
    totalWeightedCovered += weightedCovered;
  }

  if (totalWeightedStatements === 0) {
    return 0;
  }

  const percentage = (totalWeightedCovered / totalWeightedStatements) * 100;
  return Math.round(percentage * 100) / 100; // Round to 2 decimal places
}
