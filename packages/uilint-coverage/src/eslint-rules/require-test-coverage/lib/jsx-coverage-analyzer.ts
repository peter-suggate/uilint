/**
 * JSX Coverage Analyzer
 *
 * Analyzes JSX elements to determine test coverage for interactive elements
 * like event handlers. Uses Istanbul coverage data to check if the code
 * associated with JSX elements has been executed during tests.
 *
 * Phase 1: Core functions for statement-level coverage analysis
 * Phase 2: Event handler extraction and analysis
 * Phase 3: Conditional parent analysis + Component-level aggregation (partial TODO)
 * Phase 4: Import dependency coverage + ESLint rule reporting (partial TODO)
 */

import type { TSESTree } from "@typescript-eslint/utils";
import type { IstanbulCoverage } from "./coverage-aggregator.js";

/**
 * Re-export IstanbulCoverage for consumers of this module
 */
export type { IstanbulCoverage } from "./coverage-aggregator.js";

/**
 * Istanbul coverage data for a single file
 */
export type IstanbulFileCoverage = IstanbulCoverage[string];

/**
 * Source location with start and end positions
 */
export interface SourceLocation {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

/**
 * Coverage statistics for a code region
 */
export interface CoverageStats {
  /** Number of statements that were executed at least once */
  covered: number;
  /** Total number of statements in the region */
  total: number;
  /** Coverage percentage (0-100) */
  percentage: number;
}

/**
 * Coverage result for a single JSX element
 */
export interface JSXCoverageResult {
  /** The data-loc attribute value for this element */
  dataLoc: string;
  /** Whether this element has any event handlers */
  hasEventHandlers: boolean;
  /** Names of event handlers found (e.g., ["onClick", "onSubmit"]) */
  eventHandlerNames: string[];
  /** Coverage statistics for statements within this element */
  coverage: CoverageStats;
  /** Whether the element is considered "covered" (percentage > 0) */
  isCovered: boolean;
}

// =============================================================================
// Phase 1: Core Functions
// =============================================================================

/**
 * Creates a "file:line:column" format string for data-loc attribute
 *
 * @param filePath - Absolute or relative path to the file
 * @param loc - Source location with start position
 * @returns Formatted string like "src/Button.tsx:15:4"
 */
export function buildDataLoc(filePath: string, loc: SourceLocation): string {
  return `${filePath}:${loc.start.line}:${loc.start.column}`;
}

/**
 * Find statement IDs that overlap with the given source location
 *
 * A statement overlaps if its line range intersects with the location's
 * line range. Column-level precision is not used for overlap detection.
 *
 * @param loc - The source location to check
 * @param fileCoverage - Istanbul coverage data for the file
 * @returns Set of statement IDs (keys from statementMap) that overlap
 */
export function findStatementsInRange(
  loc: SourceLocation,
  fileCoverage: IstanbulFileCoverage
): Set<string> {
  const overlappingStatements = new Set<string>();

  for (const [statementId, statementLoc] of Object.entries(
    fileCoverage.statementMap
  )) {
    // Check if statement's line range overlaps with location's line range
    const statementStart = statementLoc.start.line;
    const statementEnd = statementLoc.end.line;
    const locStart = loc.start.line;
    const locEnd = loc.end.line;

    // Two ranges overlap if: start1 <= end2 AND start2 <= end1
    if (statementStart <= locEnd && locStart <= statementEnd) {
      overlappingStatements.add(statementId);
    }
  }

  return overlappingStatements;
}

/**
 * Calculate coverage statistics from a set of statement IDs
 *
 * @param statementIds - Set of statement IDs to check
 * @param fileCoverage - Istanbul coverage data for the file
 * @returns Coverage statistics with covered count, total, and percentage
 */
export function calculateCoverageFromStatements(
  statementIds: Set<string>,
  fileCoverage: IstanbulFileCoverage
): CoverageStats {
  if (statementIds.size === 0) {
    return { covered: 0, total: 0, percentage: 0 };
  }

  let covered = 0;
  const total = statementIds.size;

  for (const statementId of statementIds) {
    const hitCount = fileCoverage.s[statementId];
    if (hitCount !== undefined && hitCount > 0) {
      covered++;
    }
  }

  const percentage = total > 0 ? Math.round((covered / total) * 100) : 0;

  return { covered, total, percentage };
}

/**
 * Find coverage data for a file with path normalization
 *
 * Handles various path formats:
 * - Absolute paths
 * - Relative paths with or without leading slash
 * - Paths that may differ in their base directory
 *
 * @param coverage - Full Istanbul coverage data
 * @param filePath - The file path to find coverage for
 * @returns File coverage data if found, undefined otherwise
 */
export function findCoverageForFile(
  coverage: IstanbulCoverage,
  filePath: string
): IstanbulFileCoverage | undefined {
  // Try exact match first
  if (coverage[filePath]) {
    return coverage[filePath];
  }

  // Normalize the path for comparison (remove leading slashes, standardize)
  const normalizedPath = filePath.replace(/^\/+/, "");

  // Try with and without leading slash
  const pathVariants = [
    normalizedPath,
    `/${normalizedPath}`,
    filePath,
  ];

  for (const variant of pathVariants) {
    if (coverage[variant]) {
      return coverage[variant];
    }
  }

  // Try matching by checking if coverage path ends with our path
  for (const [coveragePath, fileCoverage] of Object.entries(coverage)) {
    const normalizedCoveragePath = coveragePath.replace(/^\/+/, "");

    if (
      normalizedCoveragePath.endsWith(normalizedPath) ||
      normalizedPath.endsWith(normalizedCoveragePath)
    ) {
      return fileCoverage;
    }
  }

  return undefined;
}

/**
 * Check if a JSX attribute is an event handler (starts with "on" followed by uppercase)
 *
 * Event handlers follow the pattern: onClick, onSubmit, onChange, etc.
 * This excludes spread attributes and non-event props like "only" or "once".
 *
 * @param attr - JSX attribute or spread attribute
 * @returns true if the attribute is an event handler
 */
export function isEventHandlerAttribute(
  attr: TSESTree.JSXAttribute | TSESTree.JSXSpreadAttribute
): boolean {
  // Spread attributes are not event handlers by themselves
  if (attr.type === "JSXSpreadAttribute") {
    return false;
  }

  // Only handle JSXIdentifier names (not namespaced like xml:lang)
  if (attr.name.type !== "JSXIdentifier") {
    return false;
  }

  const name = attr.name.name;

  // Match pattern: on[A-Z]...
  return /^on[A-Z]/.test(name);
}

/**
 * Analyze a JSX element for test coverage
 *
 * Main entry point that combines all the above functions to produce
 * a complete coverage analysis for a single JSX element.
 *
 * @param jsxNode - The JSX element node from the AST
 * @param filePath - Path to the file containing this element
 * @param coverage - Istanbul coverage data
 * @param ancestors - Optional ancestor nodes for resolving handler references
 * @param projectRoot - Optional project root for resolving import paths
 * @returns Coverage result for the JSX element
 */
export function analyzeJSXElementCoverage(
  jsxNode: TSESTree.JSXElement,
  filePath: string,
  coverage: IstanbulCoverage,
  ancestors: TSESTree.Node[] = [],
  projectRoot?: string
): JSXCoverageResult {
  // Build the data-loc identifier
  const loc = jsxNode.loc;
  const dataLoc = buildDataLoc(filePath, loc);

  // Find event handlers on this element
  const eventHandlerNames: string[] = [];
  for (const attr of jsxNode.openingElement.attributes) {
    if (isEventHandlerAttribute(attr) && attr.type === "JSXAttribute") {
      if (attr.name.type === "JSXIdentifier") {
        eventHandlerNames.push(attr.name.name);
      }
    }
  }
  const hasEventHandlers = eventHandlerNames.length > 0;

  // Find coverage data for this file
  const fileCoverage = findCoverageForFile(coverage, filePath);

  if (!fileCoverage) {
    // No coverage data available for this file
    return {
      dataLoc,
      hasEventHandlers,
      eventHandlerNames,
      coverage: { covered: 0, total: 0, percentage: 0 },
      isCovered: false,
    };
  }

  // Find statements that overlap with this JSX element
  const statementIds = findStatementsInRange(loc, fileCoverage);

  // Also include statements from event handler bodies (Phase 2)
  if (hasEventHandlers) {
    const handlerStatementIds = getHandlerStatements(
      jsxNode,
      fileCoverage,
      ancestors
    );
    for (const stmtId of handlerStatementIds) {
      statementIds.add(stmtId);
    }
  }

  // Include statements from conditional ancestors (Phase 3)
  // This ensures conditionally rendered elements include the condition's coverage
  const conditionalAncestor = findConditionalAncestor(jsxNode, ancestors);
  if (conditionalAncestor) {
    const conditionalStatementIds = getConditionalStatements(
      conditionalAncestor,
      fileCoverage
    );
    for (const stmtId of conditionalStatementIds) {
      statementIds.add(stmtId);
    }
  }

  // Calculate local coverage statistics (statements in this file)
  const localCoverage = calculateCoverageFromStatements(
    statementIds,
    fileCoverage
  );

  // Phase 4: Include import dependency coverage
  // Find imports used in this JSX element and aggregate their coverage
  let importCoverage = { covered: 0, total: 0 };
  if (projectRoot && ancestors.length > 0) {
    const importPaths = findImportsUsedInJSX(jsxNode, ancestors);
    if (importPaths.size > 0) {
      importCoverage = aggregateImportCoverage(
        importPaths,
        coverage,
        projectRoot,
        filePath
      );
    }
  }

  // Combine local and import coverage (weighted by statement count)
  const totalCovered = localCoverage.covered + importCoverage.covered;
  const totalStatements = localCoverage.total + importCoverage.total;
  const combinedPercentage =
    totalStatements > 0 ? Math.round((totalCovered / totalStatements) * 100) : 0;

  const coverageStats: CoverageStats = {
    covered: totalCovered,
    total: totalStatements,
    percentage: combinedPercentage,
  };

  return {
    dataLoc,
    hasEventHandlers,
    eventHandlerNames,
    coverage: coverageStats,
    isCovered: coverageStats.percentage > 0,
  };
}

// =============================================================================
// Phase 2: Event Handler Analysis
// =============================================================================

/**
 * Extract the expression from an event handler attribute value
 *
 * Handles various forms of event handler values:
 * - {handleClick} - identifier reference
 * - {() => doSomething()} - inline arrow function
 * - {fn.bind(this)} - call expression (like bind)
 * - {obj.method} - member expression
 *
 * @param attr - The JSX attribute to extract from
 * @returns The expression if found, null for string literals or empty values
 */
export function extractEventHandlerExpression(
  attr: TSESTree.JSXAttribute
): TSESTree.Expression | null {
  // No value means no expression (e.g., <input disabled />)
  if (!attr.value) {
    return null;
  }

  // String literals are not expressions we can analyze
  // e.g., onClick="someGlobalFunction()"
  if (attr.value.type === "Literal") {
    return null;
  }

  // JSX expression container: {expression}
  if (attr.value.type === "JSXExpressionContainer") {
    const expression = attr.value.expression;

    // Empty expression container {} or JSXEmptyExpression
    if (expression.type === "JSXEmptyExpression") {
      return null;
    }

    // Return the actual expression (Identifier, ArrowFunctionExpression, CallExpression, etc.)
    return expression;
  }

  // JSXElement as value (rare, but possible)
  // e.g., onClick={<SomeComponent />} - not a valid handler expression
  return null;
}

/**
 * Find the function declaration for an identifier used as an event handler
 *
 * Searches through the ancestor chain to find where an identifier is declared.
 * Handles:
 * - Variable declarations with function expressions
 * - Variable declarations with arrow functions
 * - Function declarations
 * - Function parameters (destructured or direct)
 *
 * @param identifier - The identifier node (e.g., the "handleClick" in onClick={handleClick})
 * @param ancestors - The ancestor nodes from the AST traversal (innermost first or any order)
 * @returns The function body node if found, null otherwise
 */
export function findHandlerFunctionDeclaration(
  identifier: TSESTree.Identifier,
  ancestors: TSESTree.Node[]
): TSESTree.Node | null {
  const targetName = identifier.name;

  for (const ancestor of ancestors) {
    // Check FunctionDeclaration
    if (
      ancestor.type === "FunctionDeclaration" &&
      ancestor.id?.name === targetName
    ) {
      return ancestor.body;
    }

    // Check VariableDeclaration
    if (ancestor.type === "VariableDeclaration") {
      for (const declarator of ancestor.declarations) {
        if (
          declarator.id.type === "Identifier" &&
          declarator.id.name === targetName &&
          declarator.init
        ) {
          // Check if the init is a function
          if (
            declarator.init.type === "ArrowFunctionExpression" ||
            declarator.init.type === "FunctionExpression"
          ) {
            return declarator.init.body;
          }
        }
      }
    }

    // Check BlockStatement and Program for contained declarations
    if (ancestor.type === "BlockStatement" || ancestor.type === "Program") {
      const body =
        ancestor.type === "Program" ? ancestor.body : ancestor.body;

      for (const statement of body) {
        // Function declarations in block
        if (
          statement.type === "FunctionDeclaration" &&
          statement.id?.name === targetName
        ) {
          return statement.body;
        }

        // Variable declarations in block
        if (statement.type === "VariableDeclaration") {
          for (const declarator of statement.declarations) {
            if (
              declarator.id.type === "Identifier" &&
              declarator.id.name === targetName &&
              declarator.init
            ) {
              if (
                declarator.init.type === "ArrowFunctionExpression" ||
                declarator.init.type === "FunctionExpression"
              ) {
                return declarator.init.body;
              }
            }
          }
        }

        // Export declarations
        if (statement.type === "ExportNamedDeclaration" && statement.declaration) {
          if (
            statement.declaration.type === "FunctionDeclaration" &&
            statement.declaration.id?.name === targetName
          ) {
            return statement.declaration.body;
          }

          if (statement.declaration.type === "VariableDeclaration") {
            for (const declarator of statement.declaration.declarations) {
              if (
                declarator.id.type === "Identifier" &&
                declarator.id.name === targetName &&
                declarator.init
              ) {
                if (
                  declarator.init.type === "ArrowFunctionExpression" ||
                  declarator.init.type === "FunctionExpression"
                ) {
                  return declarator.init.body;
                }
              }
            }
          }
        }
      }
    }

    // Check function body for nested declarations (component functions)
    if (
      ancestor.type === "ArrowFunctionExpression" ||
      ancestor.type === "FunctionExpression" ||
      ancestor.type === "FunctionDeclaration"
    ) {
      const funcBody = ancestor.body;

      // Only check BlockStatement bodies (not expression bodies)
      if (funcBody.type === "BlockStatement") {
        for (const statement of funcBody.body) {
          if (
            statement.type === "FunctionDeclaration" &&
            statement.id?.name === targetName
          ) {
            return statement.body;
          }

          if (statement.type === "VariableDeclaration") {
            for (const declarator of statement.declarations) {
              if (
                declarator.id.type === "Identifier" &&
                declarator.id.name === targetName &&
                declarator.init
              ) {
                if (
                  declarator.init.type === "ArrowFunctionExpression" ||
                  declarator.init.type === "FunctionExpression"
                ) {
                  return declarator.init.body;
                }
              }
            }
          }
        }
      }
    }
  }

  return null;
}

/**
 * Get statement IDs for all event handlers on a JSX element
 *
 * For each event handler attribute on the element:
 * - Extract the handler expression
 * - For inline arrows: find statements within the arrow body range
 * - For identifier references: find the handler declaration and its body range
 *
 * @param jsxNode - The JSX element to analyze
 * @param fileCoverage - Istanbul coverage data for the file
 * @param ancestors - Optional ancestor nodes for identifier resolution
 * @returns Set of statement IDs that are part of event handler bodies
 */
export function getHandlerStatements(
  jsxNode: TSESTree.JSXElement,
  fileCoverage: IstanbulFileCoverage,
  ancestors: TSESTree.Node[] = []
): Set<string> {
  const handlerStatements = new Set<string>();

  for (const attr of jsxNode.openingElement.attributes) {
    // Skip non-event-handler attributes
    if (!isEventHandlerAttribute(attr) || attr.type !== "JSXAttribute") {
      continue;
    }

    const expression = extractEventHandlerExpression(attr);
    if (!expression) {
      continue;
    }

    // Handle inline arrow functions and function expressions
    if (
      expression.type === "ArrowFunctionExpression" ||
      expression.type === "FunctionExpression"
    ) {
      const body = expression.body;
      if (body.loc) {
        const bodyStatements = findStatementsInRange(body.loc, fileCoverage);
        for (const stmtId of bodyStatements) {
          handlerStatements.add(stmtId);
        }
      }
      continue;
    }

    // Handle identifier references (e.g., onClick={handleClick})
    if (expression.type === "Identifier") {
      const functionBody = findHandlerFunctionDeclaration(expression, ancestors);
      if (functionBody && functionBody.loc) {
        const bodyStatements = findStatementsInRange(functionBody.loc, fileCoverage);
        for (const stmtId of bodyStatements) {
          handlerStatements.add(stmtId);
        }
      }
      continue;
    }

    // Handle call expressions (e.g., onClick={fn.bind(this)})
    // We analyze the entire call expression range
    if (expression.type === "CallExpression" && expression.loc) {
      const callStatements = findStatementsInRange(expression.loc, fileCoverage);
      for (const stmtId of callStatements) {
        handlerStatements.add(stmtId);
      }
      continue;
    }

    // Handle member expressions (e.g., onClick={obj.method})
    // These typically point to methods that we can't easily resolve
    // without more complex analysis, so we just note the expression location
    if (expression.type === "MemberExpression" && expression.loc) {
      const memberStatements = findStatementsInRange(expression.loc, fileCoverage);
      for (const stmtId of memberStatements) {
        handlerStatements.add(stmtId);
      }
    }
  }

  return handlerStatements;
}

// =============================================================================
// Phase 3: Conditional Parent Analysis
// =============================================================================

/**
 * Find a conditional ancestor that controls this element's rendering
 *
 * Walks up the ancestor chain to find the first conditional expression
 * that determines whether this JSX element is rendered:
 * - LogicalExpression with `&&`: {condition && <Element />}
 * - ConditionalExpression (ternary): {condition ? <A /> : <B />}
 *
 * @param node - The current JSX element node
 * @param ancestors - The ancestor nodes from the AST traversal
 * @returns The conditional expression if found, null otherwise
 */
export function findConditionalAncestor(
  node: TSESTree.Node,
  ancestors: TSESTree.Node[]
): TSESTree.LogicalExpression | TSESTree.ConditionalExpression | null {
  for (const ancestor of ancestors) {
    // Check for logical expression with && operator
    // Pattern: {condition && <Element />}
    if (
      ancestor.type === "LogicalExpression" &&
      ancestor.operator === "&&"
    ) {
      return ancestor;
    }

    // Check for conditional (ternary) expression
    // Pattern: {condition ? <A /> : <B />}
    if (ancestor.type === "ConditionalExpression") {
      return ancestor;
    }

    // Stop searching when we hit a JSX element boundary
    // (we don't want to cross into parent JSX elements)
    if (ancestor.type === "JSXElement" && ancestor !== node) {
      break;
    }

    // Stop at function boundaries
    if (
      ancestor.type === "ArrowFunctionExpression" ||
      ancestor.type === "FunctionExpression" ||
      ancestor.type === "FunctionDeclaration"
    ) {
      break;
    }
  }

  return null;
}

/**
 * Get statement IDs for the condition/test part of a conditional expression
 *
 * For LogicalExpression (&&): gets statements in the left operand (the condition)
 * For ConditionalExpression (ternary): gets statements in the test expression
 *
 * @param conditional - The conditional expression node
 * @param fileCoverage - Istanbul coverage data for the file
 * @returns Set of statement IDs that are part of the condition
 */
export function getConditionalStatements(
  conditional: TSESTree.LogicalExpression | TSESTree.ConditionalExpression,
  fileCoverage: IstanbulFileCoverage
): Set<string> {
  const conditionStatements = new Set<string>();

  if (conditional.type === "LogicalExpression") {
    // For &&, the left side is the condition
    const condition = conditional.left;
    if (condition.loc) {
      const statements = findStatementsInRange(condition.loc, fileCoverage);
      for (const stmtId of statements) {
        conditionStatements.add(stmtId);
      }
    }
  } else if (conditional.type === "ConditionalExpression") {
    // For ternary, the test is the condition
    const condition = conditional.test;
    if (condition.loc) {
      const statements = findStatementsInRange(condition.loc, fileCoverage);
      for (const stmtId of statements) {
        conditionStatements.add(stmtId);
      }
    }
  }

  return conditionStatements;
}

// =============================================================================
// Phase 4: Import Dependency Coverage
// =============================================================================

/**
 * Recursively collect all identifiers used within a node
 *
 * @param node - AST node to traverse
 * @param identifiers - Set to accumulate identifier names
 */
function collectIdentifiersFromNode(
  node: TSESTree.Node,
  identifiers: Set<string>
): void {
  switch (node.type) {
    case "Identifier":
      identifiers.add(node.name);
      break;

    case "JSXIdentifier":
      // JSX element names (e.g., <Component />) - these are components from imports
      identifiers.add(node.name);
      break;

    case "JSXExpressionContainer":
      if (node.expression.type !== "JSXEmptyExpression") {
        collectIdentifiersFromNode(node.expression, identifiers);
      }
      break;

    case "JSXElement":
      // Collect from opening element (tag name and attributes)
      collectIdentifiersFromNode(node.openingElement, identifiers);
      // Collect from children
      for (const child of node.children) {
        collectIdentifiersFromNode(child, identifiers);
      }
      break;

    case "JSXOpeningElement":
      // Collect from element name
      collectIdentifiersFromNode(node.name, identifiers);
      // Collect from attributes
      for (const attr of node.attributes) {
        collectIdentifiersFromNode(attr, identifiers);
      }
      break;

    case "JSXAttribute":
      // Collect from attribute value if it exists
      if (node.value) {
        collectIdentifiersFromNode(node.value, identifiers);
      }
      break;

    case "JSXSpreadAttribute":
      collectIdentifiersFromNode(node.argument, identifiers);
      break;

    case "JSXMemberExpression":
      // e.g., <Foo.Bar /> - collect the object
      collectIdentifiersFromNode(node.object, identifiers);
      break;

    case "CallExpression":
      collectIdentifiersFromNode(node.callee, identifiers);
      for (const arg of node.arguments) {
        collectIdentifiersFromNode(arg, identifiers);
      }
      break;

    case "MemberExpression":
      collectIdentifiersFromNode(node.object, identifiers);
      break;

    case "ArrowFunctionExpression":
    case "FunctionExpression":
      collectIdentifiersFromNode(node.body, identifiers);
      break;

    case "BlockStatement":
      for (const statement of node.body) {
        collectIdentifiersFromNode(statement, identifiers);
      }
      break;

    case "ExpressionStatement":
      collectIdentifiersFromNode(node.expression, identifiers);
      break;

    case "ReturnStatement":
      if (node.argument) {
        collectIdentifiersFromNode(node.argument, identifiers);
      }
      break;

    case "BinaryExpression":
    case "LogicalExpression":
      collectIdentifiersFromNode(node.left, identifiers);
      collectIdentifiersFromNode(node.right, identifiers);
      break;

    case "ConditionalExpression":
      collectIdentifiersFromNode(node.test, identifiers);
      collectIdentifiersFromNode(node.consequent, identifiers);
      collectIdentifiersFromNode(node.alternate, identifiers);
      break;

    case "UnaryExpression":
      collectIdentifiersFromNode(node.argument, identifiers);
      break;

    case "TemplateLiteral":
      for (const expr of node.expressions) {
        collectIdentifiersFromNode(expr, identifiers);
      }
      break;

    case "ArrayExpression":
      for (const element of node.elements) {
        if (element) {
          collectIdentifiersFromNode(element, identifiers);
        }
      }
      break;

    case "ObjectExpression":
      for (const prop of node.properties) {
        collectIdentifiersFromNode(prop, identifiers);
      }
      break;

    case "Property":
      collectIdentifiersFromNode(node.value, identifiers);
      break;

    case "SpreadElement":
      collectIdentifiersFromNode(node.argument, identifiers);
      break;

    case "JSXText":
    case "JSXFragment":
    case "Literal":
      // No identifiers in these
      break;

    default:
      // For other node types, we don't recurse to avoid complexity
      break;
  }
}

/**
 * Find imports used within a JSX element
 *
 * Identifies which imported modules are used within the JSX element by:
 * 1. Collecting all identifiers used in the JSX (props, children expressions, etc.)
 * 2. Walking up to the Program node to find ImportDeclaration nodes
 * 3. Matching used identifiers to their import sources
 *
 * @param jsxNode - The JSX element to analyze
 * @param ancestors - Ancestor nodes from AST traversal (should include Program)
 * @returns Set of import module specifiers (the 'from' paths) used in this JSX
 */
export function findImportsUsedInJSX(
  jsxNode: TSESTree.JSXElement,
  ancestors: TSESTree.Node[]
): Set<string> {
  const importPaths = new Set<string>();

  // Step 1: Collect all identifiers used in this JSX element
  const usedIdentifiers = new Set<string>();
  collectIdentifiersFromNode(jsxNode, usedIdentifiers);

  // Step 2: Find the Program node in ancestors to access imports
  let programNode: TSESTree.Program | null = null;
  for (const ancestor of ancestors) {
    if (ancestor.type === "Program") {
      programNode = ancestor;
      break;
    }
  }

  if (!programNode) {
    return importPaths;
  }

  // Step 3: Build a map of imported identifiers to their module sources
  const importedIdentifiers = new Map<string, string>();

  for (const statement of programNode.body) {
    if (statement.type === "ImportDeclaration") {
      const source = statement.source.value;
      if (typeof source !== "string") {
        continue;
      }

      for (const specifier of statement.specifiers) {
        switch (specifier.type) {
          case "ImportDefaultSpecifier":
            // import Foo from 'module' -> Foo maps to 'module'
            importedIdentifiers.set(specifier.local.name, source);
            break;

          case "ImportSpecifier":
            // import { Foo } from 'module' -> Foo maps to 'module'
            // import { Foo as Bar } from 'module' -> Bar maps to 'module'
            importedIdentifiers.set(specifier.local.name, source);
            break;

          case "ImportNamespaceSpecifier":
            // import * as Foo from 'module' -> Foo maps to 'module'
            importedIdentifiers.set(specifier.local.name, source);
            break;
        }
      }
    }
  }

  // Step 4: Match used identifiers to their import sources
  for (const identifier of usedIdentifiers) {
    const importSource = importedIdentifiers.get(identifier);
    if (importSource) {
      importPaths.add(importSource);
    }
  }

  return importPaths;
}

/**
 * Resolve an import path to a file path
 *
 * Handles relative imports by resolving them against the current file's directory.
 * For non-relative imports (node_modules), returns null as we don't analyze those.
 *
 * @param importPath - The import specifier (e.g., './utils' or 'react')
 * @param currentFilePath - Path of the file containing the import
 * @param projectRoot - Project root directory
 * @returns Resolved file path or null if can't be resolved
 */
function resolveImportPath(
  importPath: string,
  currentFilePath: string,
  projectRoot: string
): string | null {
  // Skip non-relative imports (node_modules packages)
  if (!importPath.startsWith(".") && !importPath.startsWith("/")) {
    return null;
  }

  // Get the directory of the current file
  const lastSlashIndex = currentFilePath.lastIndexOf("/");
  const currentDir =
    lastSlashIndex >= 0 ? currentFilePath.slice(0, lastSlashIndex) : projectRoot;

  // Resolve the relative path
  let resolvedPath: string;
  if (importPath.startsWith("/")) {
    // Absolute from project root
    resolvedPath = projectRoot + importPath;
  } else {
    // Relative path - need to resolve . and ..
    const parts = currentDir.split("/").filter(Boolean);
    const importParts = importPath.split("/");

    for (const part of importParts) {
      if (part === ".") {
        continue;
      } else if (part === "..") {
        parts.pop();
      } else {
        parts.push(part);
      }
    }

    resolvedPath = "/" + parts.join("/");
  }

  // Common extensions to try
  const extensions = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js", "/index.jsx"];

  for (const ext of extensions) {
    const fullPath = resolvedPath + ext;
    // We just return the resolved path - the caller will check if coverage exists
    // This is a simplified resolution that doesn't check file existence
    if (ext === "" && (resolvedPath.endsWith(".ts") || resolvedPath.endsWith(".tsx") ||
                       resolvedPath.endsWith(".js") || resolvedPath.endsWith(".jsx"))) {
      return resolvedPath;
    }
    if (ext !== "") {
      return fullPath;
    }
  }

  return resolvedPath;
}

/**
 * Aggregate coverage from imported files
 *
 * For each import path, attempts to find coverage data for that file
 * and aggregates the statement coverage across all imported files.
 *
 * Note: When an import is used, the entire imported file's coverage is included
 * in the calculation (full file coverage when any part of a dependency is used).
 *
 * @param importPaths - Set of import module specifiers
 * @param coverage - Istanbul coverage data
 * @param projectRoot - Project root directory
 * @param currentFilePath - Path of the file containing the imports (for resolving relative paths)
 * @returns Aggregated coverage stats: { covered: number, total: number }
 */
export function aggregateImportCoverage(
  importPaths: Set<string>,
  coverage: IstanbulCoverage,
  projectRoot: string,
  currentFilePath: string = ""
): { covered: number; total: number } {
  let totalCovered = 0;
  let totalStatements = 0;

  for (const importPath of importPaths) {
    // Try to resolve the import path to a file path
    const resolvedPath = resolveImportPath(importPath, currentFilePath, projectRoot);

    if (!resolvedPath) {
      // Non-relative import (node_modules) - skip
      continue;
    }

    // Try to find coverage for this file
    const fileCoverage = findCoverageForFile(coverage, resolvedPath);

    if (!fileCoverage) {
      // Also try with the raw import path in case coverage uses that format
      const rawCoverage = findCoverageForFile(coverage, importPath);
      if (!rawCoverage) {
        continue;
      }
      // Use the raw coverage
      const statementCount = Object.keys(rawCoverage.s).length;
      const coveredCount = Object.values(rawCoverage.s).filter((hits) => hits > 0).length;
      totalStatements += statementCount;
      totalCovered += coveredCount;
      continue;
    }

    // Aggregate full file coverage (all statements in the imported file)
    const statementCount = Object.keys(fileCoverage.s).length;
    const coveredCount = Object.values(fileCoverage.s).filter((hits) => hits > 0).length;

    totalStatements += statementCount;
    totalCovered += coveredCount;
  }

  return { covered: totalCovered, total: totalStatements };
}
