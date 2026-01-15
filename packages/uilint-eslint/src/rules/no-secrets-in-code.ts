/**
 * Rule: no-secrets-in-code
 *
 * Detects hardcoded secrets, API keys, passwords, and tokens in source code.
 * Prevents accidental exposure of sensitive credentials.
 *
 * Examples:
 * - Bad: const apiKey = 'AKIA1234567890ABCDEF'
 * - Bad: const password = 'mySecretPassword123'
 * - Good: const apiKey = process.env.API_KEY
 */

import { createRule, defineRuleMeta } from "../utils/create-rule.js";
import type { TSESTree } from "@typescript-eslint/utils";

type MessageIds = "secretDetected" | "suspiciousVariable";
type Options = [
  {
    /** Additional regex patterns to detect (as strings) */
    additionalPatterns?: Array<{ name: string; pattern: string }>;
    /** Check variable names for suspicious patterns */
    checkVariableNames?: boolean;
    /** Minimum length for generic secret detection */
    minSecretLength?: number;
    /** Relax rules in test files */
    allowInTestFiles?: boolean;
  }
];

/**
 * Rule metadata - colocated with implementation for maintainability
 */
export const meta = defineRuleMeta({
  id: "no-secrets-in-code",
  name: "No Secrets in Code",
  description: "Detect hardcoded secrets, API keys, and tokens",
  defaultSeverity: "error",
  category: "static",
  defaultOptions: [
    {
      checkVariableNames: true,
      minSecretLength: 16,
      allowInTestFiles: false,
    },
  ],
  optionSchema: {
    fields: [
      {
        key: "checkVariableNames",
        label: "Check variable names",
        type: "boolean",
        defaultValue: true,
        description: "Check for suspicious variable names with high-entropy values",
      },
      {
        key: "minSecretLength",
        label: "Minimum secret length",
        type: "number",
        defaultValue: 16,
        description: "Minimum string length for generic secret detection",
      },
      {
        key: "allowInTestFiles",
        label: "Allow in test files",
        type: "boolean",
        defaultValue: false,
        description: "Skip detection in test files (*.test.*, *.spec.*)",
      },
    ],
  },
  docs: `
## What it does

Detects hardcoded secrets, API keys, passwords, and tokens in source code.
These should be stored in environment variables or secure vaults instead.

## Why it's useful

- **Security**: Prevents credential leaks in version control
- **Compliance**: Helps meet security audit requirements
- **Best Practice**: Enforces proper secrets management

## Detected Patterns

- AWS Access Keys and Secret Keys
- GitHub Personal Access Tokens (ghp_*)
- Stripe API Keys (sk_live_*, sk_test_*)
- Google API Keys
- Firebase Keys
- Slack Tokens
- npm Tokens
- JWT Tokens
- Private Keys (PEM format)
- Generic API keys, passwords, and secrets in suspicious variables

## Examples

### ❌ Incorrect

\`\`\`tsx
// Hardcoded AWS credentials
const accessKey = 'AKIA1234567890ABCDEF';
const secretKey = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';

// Hardcoded passwords
const dbPassword = 'supersecretpassword123';

// Hardcoded tokens
const token = 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
\`\`\`

### ✅ Correct

\`\`\`tsx
// Use environment variables
const accessKey = process.env.AWS_ACCESS_KEY_ID;
const secretKey = process.env.AWS_SECRET_ACCESS_KEY;

// Reference from config
const dbPassword = config.database.password;

// Use a secrets manager
const token = await secretsManager.getSecret('github-token');
\`\`\`

## Configuration

\`\`\`js
// eslint.config.js
"uilint/no-secrets-in-code": ["error", {
  checkVariableNames: true,    // Check suspicious variable names
  minSecretLength: 16,         // Minimum length for generic detection
  allowInTestFiles: false,     // Don't skip test files
  additionalPatterns: [        // Add custom patterns
    { name: "Custom API", pattern: "^myapi_[a-z0-9]{32}$" }
  ]
}]
\`\`\`
`,
});

/**
 * Known secret patterns with names and regex
 */
const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  // AWS
  { name: "AWS Access Key ID", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "AWS Secret Access Key", pattern: /\b[A-Za-z0-9/+=]{40}\b/ },

  // GitHub
  { name: "GitHub Personal Access Token", pattern: /\bghp_[A-Za-z0-9]{36}\b/ },
  { name: "GitHub OAuth Token", pattern: /\bgho_[A-Za-z0-9]{36}\b/ },
  { name: "GitHub App Token", pattern: /\bghu_[A-Za-z0-9]{36}\b/ },
  { name: "GitHub Refresh Token", pattern: /\bghr_[A-Za-z0-9]{36}\b/ },

  // Stripe
  { name: "Stripe Live Secret Key", pattern: /\bsk_live_[A-Za-z0-9]{24,}\b/ },
  { name: "Stripe Test Secret Key", pattern: /\bsk_test_[A-Za-z0-9]{24,}\b/ },
  { name: "Stripe Restricted Key", pattern: /\brk_live_[A-Za-z0-9]{24,}\b/ },

  // Google
  { name: "Google API Key", pattern: /\bAIza[A-Za-z0-9_-]{35}\b/ },

  // Slack
  { name: "Slack Token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,48}\b/ },
  { name: "Slack Webhook", pattern: /\bhooks\.slack\.com\/services\/T[A-Za-z0-9]+\/B[A-Za-z0-9]+\/[A-Za-z0-9]+\b/ },

  // npm
  { name: "npm Token", pattern: /\bnpm_[A-Za-z0-9]{36}\b/ },

  // SendGrid
  { name: "SendGrid API Key", pattern: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/ },

  // Twilio
  { name: "Twilio API Key", pattern: /\bSK[a-z0-9]{32}\b/ },

  // Firebase
  { name: "Firebase Key", pattern: /\bAAAA[A-Za-z0-9_-]{7}:[A-Za-z0-9_-]{140}\b/ },

  // Generic patterns
  { name: "Private Key", pattern: /-----BEGIN\s+(RSA\s+|EC\s+|DSA\s+|OPENSSH\s+)?PRIVATE\s+KEY-----/ },
  { name: "JWT Token", pattern: /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/ },

  // Anthropic
  { name: "Anthropic API Key", pattern: /\bsk-ant-api[A-Za-z0-9_-]{20,}\b/ },

  // OpenAI
  { name: "OpenAI API Key", pattern: /\bsk-proj-[A-Za-z0-9_-]{20,}\b/ },
  { name: "OpenAI API Key (old)", pattern: /\bsk-[A-Za-z0-9]{48}\b/ },
];

/**
 * Variable name patterns that suggest secrets
 */
const SUSPICIOUS_VARIABLE_PATTERNS: RegExp[] = [
  /^api[_-]?key$/i,
  /^secret[_-]?key$/i,
  /^private[_-]?key$/i,
  /^access[_-]?key$/i,
  /^auth[_-]?key$/i,
  /^access[_-]?token$/i,
  /^auth[_-]?token$/i,
  /^api[_-]?token$/i,
  /^bearer[_-]?token$/i,
  /^jwt[_-]?token$/i,
  /^refresh[_-]?token$/i,
  /^password$/i,
  /^passwd$/i,
  /^pwd$/i,
  /^db[_-]?password$/i,
  /^database[_-]?password$/i,
  /^secret$/i,
  /^client[_-]?secret$/i,
  /^app[_-]?secret$/i,
];

/**
 * Patterns that indicate safe/placeholder values
 */
const PLACEHOLDER_PATTERNS: RegExp[] = [
  /^your[_-]?/i,
  /^xxx+$/i,
  /^placeholder/i,
  /^example/i,
  /^test[_-]?/i,
  /^fake[_-]?/i,
  /^dummy/i,
  /^sample/i,
  /<[^>]+>/,  // <your-key-here>
  /\${[^}]+}/,  // ${API_KEY}
  /^\*+$/,  // ****
];

/**
 * Calculate Shannon entropy of a string
 */
function calculateEntropy(str: string): number {
  if (str.length === 0) return 0;

  const freq: Record<string, number> = {};
  for (const char of str) {
    freq[char] = (freq[char] || 0) + 1;
  }

  let entropy = 0;
  const len = str.length;
  for (const count of Object.values(freq)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

/**
 * Check if a value looks like a placeholder
 */
function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Check if a value is likely an environment variable reference
 */
function isEnvReference(value: string): boolean {
  return value.includes("process.env") || value.includes("import.meta.env");
}

/**
 * Get a preview of the secret (first and last few chars)
 */
function getPreview(value: string, maxLength: number = 20): string {
  if (value.length <= maxLength) {
    return value.substring(0, 8) + "...";
  }
  return value.substring(0, 8) + "..." + value.substring(value.length - 4);
}

/**
 * Check if file is a test file
 */
function isTestFile(filename: string): boolean {
  return /\.(test|spec)\.[jt]sx?$/.test(filename) ||
         /\/__tests__\//.test(filename) ||
         /\/test\//.test(filename);
}

export default createRule<Options, MessageIds>({
  name: "no-secrets-in-code",
  meta: {
    type: "problem",
    docs: {
      description: "Detect hardcoded secrets, API keys, and tokens",
    },
    messages: {
      secretDetected:
        "Potential {{secretType}} detected: '{{preview}}'. Use environment variables instead of hardcoding secrets.",
      suspiciousVariable:
        "Variable '{{variableName}}' appears to contain a secret. Use environment variables instead.",
    },
    schema: [
      {
        type: "object",
        properties: {
          additionalPatterns: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                pattern: { type: "string" },
              },
              required: ["name", "pattern"],
            },
            description: "Additional patterns to detect",
          },
          checkVariableNames: {
            type: "boolean",
            description: "Check variable names for suspicious patterns",
          },
          minSecretLength: {
            type: "number",
            description: "Minimum length for generic secret detection",
          },
          allowInTestFiles: {
            type: "boolean",
            description: "Skip detection in test files",
          },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [
    {
      checkVariableNames: true,
      minSecretLength: 16,
      allowInTestFiles: false,
    },
  ],
  create(context) {
    const options = context.options[0] || {};
    const checkVariableNames = options.checkVariableNames ?? true;
    const minSecretLength = options.minSecretLength ?? 16;
    const allowInTestFiles = options.allowInTestFiles ?? false;
    const additionalPatterns = options.additionalPatterns ?? [];

    const filename = context.filename || context.getFilename?.() || "";

    // Skip test files if configured
    if (allowInTestFiles && isTestFile(filename)) {
      return {};
    }

    // Build full pattern list
    const allPatterns = [...SECRET_PATTERNS];
    for (const custom of additionalPatterns) {
      try {
        allPatterns.push({
          name: custom.name,
          pattern: new RegExp(custom.pattern),
        });
      } catch {
        // Invalid regex, skip
      }
    }

    /**
     * Check a string value for secrets
     */
    function checkStringForSecrets(
      value: string,
      node: TSESTree.Node,
      variableName?: string
    ): void {
      // Skip empty strings and short strings
      if (!value || value.length < 8) {
        return;
      }

      // Skip placeholders
      if (isPlaceholder(value)) {
        return;
      }

      // Check against known patterns
      for (const { name, pattern } of allPatterns) {
        if (pattern.test(value)) {
          context.report({
            node,
            messageId: "secretDetected",
            data: {
              secretType: name,
              preview: getPreview(value),
            },
          });
          return;
        }
      }

      // Check for suspicious variable names with high-entropy values
      if (checkVariableNames && variableName) {
        const isSuspiciousName = SUSPICIOUS_VARIABLE_PATTERNS.some((pattern) =>
          pattern.test(variableName)
        );

        if (isSuspiciousName && value.length >= minSecretLength) {
          const entropy = calculateEntropy(value);
          // High entropy (> 3.5) suggests random/secret data
          if (entropy > 3.5) {
            context.report({
              node,
              messageId: "suspiciousVariable",
              data: {
                variableName,
              },
            });
          }
        }
      }
    }

    /**
     * Get variable name from declarator
     */
    function getVariableName(node: TSESTree.Node): string | undefined {
      if (node.parent?.type === "VariableDeclarator") {
        const declarator = node.parent;
        if (declarator.id.type === "Identifier") {
          return declarator.id.name;
        }
      }
      if (node.parent?.type === "Property") {
        const prop = node.parent;
        if (prop.key.type === "Identifier") {
          return prop.key.name;
        }
      }
      return undefined;
    }

    return {
      // Check string literals
      Literal(node) {
        if (typeof node.value === "string") {
          const variableName = getVariableName(node);
          checkStringForSecrets(node.value, node, variableName);
        }
      },

      // Check template literals
      TemplateLiteral(node) {
        // Only check if no expressions (pure string)
        if (node.expressions.length === 0 && node.quasis.length === 1) {
          const value = node.quasis[0].value.raw;
          const variableName = getVariableName(node);
          checkStringForSecrets(value, node, variableName);
        }
      },
    };
  },
});
