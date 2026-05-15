/**
 * Rule: no-raw-ui-elements
 *
 * Flags raw form/control elements when a component framework is preferred.
 * Coding agents often reach for <button>, <input>, or <textarea> even when
 * a project already has shadcn/ui, MUI, Chakra, or Ant Design available.
 */

import { existsSync, readFileSync } from "fs";
import { dirname, join, parse, resolve } from "path";
import { createRule, defineRuleMeta } from "../utils/create-rule.js";
import type { TSESTree } from "@typescript-eslint/utils";

type PreferredFramework = "auto" | "shadcn" | "mui" | "chakra" | "antd" | "custom";
type ElementKey =
  | "button"
  | "input"
  | "input:checkbox"
  | "input:radio"
  | "input:range"
  | "textarea"
  | "select"
  | "dialog";

type MessageIds = "rawElement";
type Options = [
  {
    /** Preferred UI framework. "auto" detects from package.json and shadcn component files. */
    preferred?: PreferredFramework;
    /** Elements to report. Supports input variants like "input:checkbox". */
    elements?: string[];
    /** Override suggestions per element, e.g. { button: "Button from @/components/ui/button" }. */
    components?: Partial<Record<ElementKey, string>>;
    /** File path globs or substrings where raw elements are allowed. */
    ignoreFiles?: string[];
  }?
];

const DEFAULT_ELEMENTS: ElementKey[] = [
  "button",
  "input",
  "input:checkbox",
  "input:radio",
  "input:range",
  "textarea",
  "select",
];

const FRAMEWORK_LABELS: Record<Exclude<PreferredFramework, "auto">, string> = {
  shadcn: "shadcn/ui",
  mui: "MUI",
  chakra: "Chakra UI",
  antd: "Ant Design",
  custom: "your component framework",
};

const DEFAULT_COMPONENTS: Record<
  Exclude<PreferredFramework, "auto" | "custom">,
  Record<ElementKey, string>
> = {
  shadcn: {
    button: 'Button from "@/components/ui/button"',
    input: 'Input from "@/components/ui/input"',
    "input:checkbox": 'Checkbox from "@/components/ui/checkbox"',
    "input:radio": 'RadioGroup/RadioGroupItem from "@/components/ui/radio-group"',
    "input:range": 'Slider from "@/components/ui/slider"',
    textarea: 'Textarea from "@/components/ui/textarea"',
    select: 'Select from "@/components/ui/select"',
    dialog: 'Dialog from "@/components/ui/dialog"',
  },
  mui: {
    button: 'Button from "@mui/material"',
    input: 'TextField from "@mui/material"',
    "input:checkbox": 'Checkbox from "@mui/material"',
    "input:radio": 'RadioGroup and Radio from "@mui/material"',
    "input:range": 'Slider from "@mui/material"',
    textarea: 'TextField with multiline from "@mui/material"',
    select: 'Select from "@mui/material"',
    dialog: 'Dialog from "@mui/material"',
  },
  chakra: {
    button: 'Button from "@chakra-ui/react"',
    input: 'Input from "@chakra-ui/react"',
    "input:checkbox": 'Checkbox from "@chakra-ui/react"',
    "input:radio": 'RadioGroup and Radio from "@chakra-ui/react"',
    "input:range": 'Slider from "@chakra-ui/react"',
    textarea: 'Textarea from "@chakra-ui/react"',
    select: 'Select from "@chakra-ui/react"',
    dialog: 'Modal from "@chakra-ui/react"',
  },
  antd: {
    button: 'Button from "antd"',
    input: 'Input from "antd"',
    "input:checkbox": 'Checkbox from "antd"',
    "input:radio": 'Radio.Group and Radio from "antd"',
    "input:range": 'Slider from "antd"',
    textarea: 'Input.TextArea from "antd"',
    select: 'Select from "antd"',
    dialog: 'Modal from "antd"',
  },
};

const packageRootCache = new Map<string, string | null>();
const frameworkCache = new Map<string, Exclude<PreferredFramework, "auto"> | null>();
const shadcnUiDirsCache = new Map<string, string[]>();

const COMPONENT_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];
const SHADCN_COMPONENT_FILES = [
  "button",
  "input",
  "textarea",
  "checkbox",
  "select",
  "dialog",
  "slider",
  "radio-group",
];
const FALLBACK_SHADCN_UI_DIRS = [
  "components/ui",
  "src/components/ui",
  "app/components/ui",
];

export const meta = defineRuleMeta({
  id: "no-raw-ui-elements",
  version: "1.0.0",
  name: "No Raw UI Elements",
  description: "Prefer project UI components over raw form/control elements",
  defaultSeverity: "warn",
  category: "static",
  icon: "🧱",
  hint: "Guides agents toward the project's component framework",
  defaultEnabled: true,
  defaultOptions: [{ preferred: "auto", elements: DEFAULT_ELEMENTS }],
  optionSchema: {
    fields: [
      {
        key: "preferred",
        label: "Preferred component framework",
        type: "select",
        defaultValue: "auto",
        options: [
          { value: "auto", label: "Auto-detect" },
          { value: "shadcn", label: "shadcn/ui" },
          { value: "mui", label: "MUI (Material-UI)" },
          { value: "chakra", label: "Chakra UI" },
          { value: "antd", label: "Ant Design" },
          { value: "custom", label: "Custom design system" },
        ],
        description: "The framework whose components should replace raw controls.",
      },
      {
        key: "elements",
        label: "Raw elements to flag",
        type: "multiselect",
        defaultValue: DEFAULT_ELEMENTS,
        options: [
          { value: "button", label: "<button>" },
          { value: "input", label: '<input type="text">' },
          { value: "input:checkbox", label: '<input type="checkbox">' },
          { value: "input:radio", label: '<input type="radio">' },
          { value: "input:range", label: '<input type="range">' },
          { value: "textarea", label: "<textarea>" },
          { value: "select", label: "<select>" },
          { value: "dialog", label: "<dialog>" },
        ],
        description: "HTML controls that should use framework components instead.",
      },
    ],
  },
  docs: `
## What it does

Reports raw interactive/form elements when the project has a preferred component
framework. This is aimed at coding-agent drift: agents often introduce
\`<button>\`, \`<textarea>\`, or \`<input>\` even when a project already uses a
component framework.

## Why it's useful

- **Consistency**: Keeps controls on the same visual and accessibility system
- **Migration support**: Makes raw primitives visible while moving to a framework
- **Agent guardrails**: Gives coding agents a concrete replacement target
- **Safe defaults**: \`preferred: "auto"\` only reports after a framework is detected

## Examples

### ❌ Incorrect (with preferred: "shadcn")

\`\`\`tsx
export function Form() {
  return (
    <form>
      <textarea />
      <button type="submit">Save</button>
    </form>
  );
}
\`\`\`

### ✅ Correct

\`\`\`tsx
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function Form() {
  return (
    <form>
      <Textarea />
      <Button type="submit">Save</Button>
    </form>
  );
}
\`\`\`

## Configuration

\`\`\`js
"uilint/no-raw-ui-elements": ["warn", {
  preferred: "auto",
  elements: ["button", "input", "input:checkbox", "textarea", "select"],
  components: {
    button: "Button from @/components/ui/button",
    textarea: "Textarea from @/components/ui/textarea"
  },
  ignoreFiles: ["**/legacy/**"]
}]
\`\`\`

## Framework detection

\`preferred: "auto"\` detects:

- shadcn/ui via \`components.json\` \`aliases.ui\`, then common \`components/ui/*\` files
- MUI via \`@mui/material\`
- Chakra UI via \`@chakra-ui/react\`
- Ant Design via \`antd\`

If auto-detection cannot find a component framework, the rule does not report.
Pin \`preferred\` to enforce a specific framework.
`,
});

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function findPackageRoot(filename: string): string | null {
  const start = normalizePath(filename);
  const fromDir = start.includes("/") ? dirname(start) : start;
  const cached = packageRootCache.get(fromDir);
  if (cached !== undefined) return cached;

  let dir = fromDir;
  const root = parse(dir).root;

  while (dir && dir !== root) {
    if (existsSync(join(dir, "package.json"))) {
      packageRootCache.set(fromDir, dir);
      return dir;
    }
    dir = dirname(dir);
  }

  packageRootCache.set(fromDir, null);
  return null;
}

function readPackageDependencies(root: string): Record<string, string> {
  try {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };
  } catch {
    return {};
  }
}

function dedupePaths(paths: string[]): string[] {
  return [...new Set(paths.map((path) => normalizePath(path)))];
}

function findNearestFile(startDir: string, filename: string): string | null {
  let dir = startDir;
  const root = parse(dir).root;

  while (dir && dir !== root) {
    const candidate = join(dir, filename);
    if (existsSync(candidate)) return candidate;
    dir = dirname(dir);
  }

  return null;
}

interface ComponentsJson {
  aliases?: {
    ui?: unknown;
  };
}

interface TsConfigJson {
  compilerOptions?: {
    baseUrl?: string;
    paths?: Record<string, string[]>;
  };
}

function readComponentsUiAlias(root: string): string | null {
  try {
    const config = JSON.parse(
      readFileSync(join(root, "components.json"), "utf-8")
    ) as ComponentsJson;
    return typeof config.aliases?.ui === "string" ? config.aliases.ui : null;
  } catch {
    return null;
  }
}

function readTsConfig(tsconfigPath: string): TsConfigJson | null {
  try {
    return JSON.parse(readFileSync(tsconfigPath, "utf-8")) as TsConfigJson;
  } catch {
    return null;
  }
}

function resolvePathTarget(baseDir: string, target: string): string {
  return resolve(baseDir, target);
}

function resolveWithTsconfigPaths(root: string, specifier: string): string[] {
  const tsconfigPath = findNearestFile(root, "tsconfig.json");
  if (!tsconfigPath) return [];

  const tsconfig = readTsConfig(tsconfigPath);
  const compilerOptions = tsconfig?.compilerOptions;
  const paths = compilerOptions?.paths;
  if (!paths) return [];

  const configDir = dirname(tsconfigPath);
  const baseUrl = compilerOptions.baseUrl
    ? resolve(configDir, compilerOptions.baseUrl)
    : configDir;
  const resolved: string[] = [];

  for (const [pattern, targets] of Object.entries(paths)) {
    if (!Array.isArray(targets)) continue;

    if (!pattern.includes("*")) {
      if (pattern === specifier) {
        resolved.push(...targets.map((target) => resolvePathTarget(baseUrl, target)));
      }
      continue;
    }

    const [prefix = "", suffix = ""] = pattern.split("*");
    if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) continue;

    const wildcard = specifier.slice(
      prefix.length,
      specifier.length - suffix.length
    );

    for (const target of targets) {
      resolved.push(resolvePathTarget(baseUrl, target.replace("*", wildcard)));
    }
  }

  return resolved;
}

function resolveComponentsAlias(root: string, alias: string): string[] {
  const trimmed = alias.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith(".") || trimmed.startsWith("/")) {
    return [resolve(root, trimmed)];
  }

  const tsconfigResolved = resolveWithTsconfigPaths(root, trimmed);
  if (tsconfigResolved.length > 0) {
    return tsconfigResolved;
  }

  if (trimmed.startsWith("@/") || trimmed.startsWith("~/")) {
    const withoutAlias = trimmed.slice(2);
    return [resolve(root, withoutAlias), resolve(root, "src", withoutAlias)];
  }

  return [resolve(root, trimmed)];
}

function getShadcnUiDirs(root: string): string[] {
  const cached = shadcnUiDirsCache.get(root);
  if (cached) return cached;

  const configuredAlias = readComponentsUiAlias(root);
  const configuredDirs = configuredAlias
    ? resolveComponentsAlias(root, configuredAlias)
    : [];
  const fallbackDirs = FALLBACK_SHADCN_UI_DIRS.map((dir) => resolve(root, dir));
  const dirs = dedupePaths([...configuredDirs, ...fallbackDirs]);

  shadcnUiDirsCache.set(root, dirs);
  return dirs;
}

function hasComponentFile(dir: string, componentName: string): boolean {
  return COMPONENT_EXTENSIONS.some((ext) =>
    existsSync(join(dir, `${componentName}${ext}`))
  );
}

function hasShadcnComponentFile(dir: string): boolean {
  return SHADCN_COMPONENT_FILES.some((componentName) =>
    hasComponentFile(dir, componentName)
  );
}

function hasShadcnComponents(root: string): boolean {
  return getShadcnUiDirs(root).some(hasShadcnComponentFile);
}

function detectFramework(
  filename: string
): Exclude<PreferredFramework, "auto"> | null {
  const root = findPackageRoot(filename);
  if (!root) return null;

  const cached = frameworkCache.get(root);
  if (cached !== undefined) return cached;

  const deps = readPackageDependencies(root);
  let framework: Exclude<PreferredFramework, "auto"> | null = null;

  if (hasShadcnComponents(root)) {
    framework = "shadcn";
  } else if ("@mui/material" in deps) {
    framework = "mui";
  } else if ("@chakra-ui/react" in deps) {
    framework = "chakra";
  } else if ("antd" in deps) {
    framework = "antd";
  }

  frameworkCache.set(root, framework);
  return framework;
}

function getLiteralAttributeValue(
  node: TSESTree.JSXOpeningElement,
  name: string
): string | null {
  const attr = node.attributes.find(
    (candidate): candidate is TSESTree.JSXAttribute =>
      candidate.type === "JSXAttribute" &&
      candidate.name.type === "JSXIdentifier" &&
      candidate.name.name === name
  );

  if (!attr?.value) return null;

  if (attr.value.type === "Literal" && typeof attr.value.value === "string") {
    return attr.value.value;
  }

  if (
    attr.value.type === "JSXExpressionContainer" &&
    attr.value.expression.type === "Literal" &&
    typeof attr.value.expression.value === "string"
  ) {
    return attr.value.expression.value;
  }

  return null;
}

function getElementName(node: TSESTree.JSXOpeningElement): string | null {
  return node.name.type === "JSXIdentifier" ? node.name.name : null;
}

function getElementKey(node: TSESTree.JSXOpeningElement): ElementKey | null {
  const name = getElementName(node);
  if (!name) return null;

  if (name === "input") {
    const type = getLiteralAttributeValue(node, "type")?.toLowerCase();
    if (type === "checkbox") return "input:checkbox";
    if (type === "radio") return "input:radio";
    if (type === "range") return "input:range";
    return "input";
  }

  if (
    name === "button" ||
    name === "textarea" ||
    name === "select" ||
    name === "dialog"
  ) {
    return name;
  }

  return null;
}

function globToRegExp(pattern: string): RegExp {
  const escaped = normalizePath(pattern).replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const globbed = escaped
    .replace(/\*\*/g, "__UILINT_GLOBSTAR__")
    .replace(/\*/g, "[^/]*")
    .replace(/__UILINT_GLOBSTAR__/g, ".*");
  return new RegExp(`^${globbed}$`);
}

function matchesIgnoredFile(filename: string, patterns: string[]): boolean {
  const normalized = normalizePath(filename);
  return patterns.some((pattern) => {
    const normalizedPattern = normalizePath(pattern);
    if (normalized.includes(normalizedPattern)) return true;
    return globToRegExp(normalizedPattern).test(normalized);
  });
}

function isShadcnPrimitiveImplementation(
  filename: string,
  elementKey: ElementKey
): boolean {
  const normalized = normalizePath(filename);
  const fileByElement: Partial<Record<ElementKey, string>> = {
    button: "button",
    input: "input",
    "input:checkbox": "checkbox",
    "input:radio": "radio-group",
    "input:range": "slider",
    textarea: "textarea",
    select: "select",
    dialog: "dialog",
  };
  const componentFile = fileByElement[elementKey];
  if (!componentFile) return false;

  const root = findPackageRoot(filename);
  if (root) {
    return getShadcnUiDirs(root).some((dir) => {
      const normalizedDir = normalizePath(dir);
      return COMPONENT_EXTENSIONS.some(
        (ext) => normalized === `${normalizedDir}/${componentFile}${ext}`
      );
    });
  }

  return new RegExp(`/components/ui/${componentFile}\\.(t|j)sx?$`).test(normalized);
}

function shouldReportElement(
  configuredElements: Set<string>,
  elementKey: ElementKey
): boolean {
  if (configuredElements.has(elementKey)) return true;
  if (elementKey.startsWith("input:")) return configuredElements.has("input");
  return false;
}

function getReplacement(
  framework: Exclude<PreferredFramework, "auto">,
  elementKey: ElementKey,
  customComponents: Partial<Record<ElementKey, string>> | undefined
): string {
  const custom = customComponents?.[elementKey];
  if (custom) return custom;

  if (framework === "custom") {
    return `your design-system ${elementKey.replace("input:", "")} component`;
  }

  return DEFAULT_COMPONENTS[framework][elementKey];
}

export default createRule<Options, MessageIds>({
  name: "no-raw-ui-elements",
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer project UI framework components over raw form/control elements.",
    },
    messages: {
      rawElement:
        "Use {{replacement}} instead of raw <{{element}}> in {{framework}} projects.",
    },
    schema: [
      {
        type: "object",
        properties: {
          preferred: {
            type: "string",
            enum: ["auto", "shadcn", "mui", "chakra", "antd", "custom"],
          },
          elements: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "button",
                "input",
                "input:checkbox",
                "input:radio",
                "input:range",
                "textarea",
                "select",
                "dialog",
              ],
            },
          },
          components: {
            type: "object",
            additionalProperties: { type: "string" },
          },
          ignoreFiles: {
            type: "array",
            items: { type: "string" },
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [{ preferred: "auto", elements: DEFAULT_ELEMENTS }],
  create(context) {
    const options = context.options[0] ?? {};
    const filename = context.filename || context.getFilename();
    const configuredElements = new Set(options.elements ?? DEFAULT_ELEMENTS);
    const preferred = options.preferred ?? "auto";
    const framework =
      preferred === "auto" ? detectFramework(filename) : preferred;

    if (!framework) return {};

    return {
      JSXOpeningElement(node) {
        const elementKey = getElementKey(node);
        if (!elementKey || !shouldReportElement(configuredElements, elementKey)) {
          return;
        }

        if (matchesIgnoredFile(filename, options.ignoreFiles ?? [])) {
          return;
        }

        if (
          framework === "shadcn" &&
          isShadcnPrimitiveImplementation(filename, elementKey)
        ) {
          return;
        }

        const elementName = getElementName(node) ?? elementKey;
        context.report({
          node,
          messageId: "rawElement",
          data: {
            element: elementName,
            framework: FRAMEWORK_LABELS[framework],
            replacement: getReplacement(
              framework,
              elementKey,
              options.components
            ),
          },
        });
      },
    };
  },
});
