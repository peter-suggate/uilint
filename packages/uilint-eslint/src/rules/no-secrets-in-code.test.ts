/**
 * Tests for: no-secrets-in-code
 *
 * Tests the detection of hardcoded secrets, API keys, and tokens.
 */

import { RuleTester } from "@typescript-eslint/rule-tester";
import { describe, it, afterAll } from "vitest";
import rule from "./no-secrets-in-code.js";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

ruleTester.run("no-secrets-in-code", rule, {
  valid: [
    // ============================================
    // ENVIRONMENT VARIABLE REFERENCES
    // ============================================
    {
      name: "process.env reference",
      code: `const apiKey = process.env.API_KEY;`,
    },
    {
      name: "import.meta.env reference",
      code: `const secret = import.meta.env.VITE_SECRET;`,
    },
    {
      name: "env variable in template literal",
      code: `const url = \`https://api.example.com?key=\${process.env.API_KEY}\`;`,
    },

    // ============================================
    // PLACEHOLDER VALUES
    // ============================================
    {
      name: "placeholder - your_key_here",
      code: `const apiKey = 'your_api_key_here';`,
    },
    {
      name: "placeholder - xxx",
      code: `const token = 'xxxxxxxxxxxxxxxx';`,
    },
    {
      name: "placeholder - example",
      code: `const secret = 'example_secret_value';`,
    },
    {
      name: "placeholder - test prefix",
      code: `const key = 'test_key_12345';`,
    },
    {
      name: "placeholder - fake",
      code: `const password = 'fake_password';`,
    },
    {
      name: "placeholder with angle brackets",
      code: `const key = '<your-api-key>';`,
    },
    {
      name: "placeholder with template var",
      code: `const key = '\${API_KEY}';`,
    },
    {
      name: "asterisks placeholder",
      code: `const masked = '****************';`,
    },

    // ============================================
    // SHORT STRINGS (below threshold)
    // ============================================
    {
      name: "short string - id",
      code: `const id = 'abc123';`,
    },
    {
      name: "short string - status",
      code: `const status = 'active';`,
    },
    {
      name: "empty string",
      code: `const value = '';`,
    },

    // ============================================
    // CONFIG REFERENCES
    // ============================================
    {
      name: "config reference",
      code: `const dbPassword = config.database.password;`,
    },
    {
      name: "settings reference",
      code: `const apiKey = settings.getApiKey();`,
    },
    {
      name: "secrets manager reference",
      code: `const token = await secretsManager.getSecret('github-token');`,
    },

    // ============================================
    // NORMAL STRINGS (not secrets)
    // ============================================
    {
      name: "regular string - URL",
      code: `const url = 'https://api.example.com/v1/users';`,
    },
    {
      name: "regular string - message",
      code: `const message = 'Hello, world!';`,
    },
    {
      name: "regular string - path",
      code: `const path = '/home/user/documents';`,
    },
    {
      name: "regular string - CSS class",
      code: `const className = 'btn btn-primary btn-lg';`,
    },
    {
      name: "regular string - UUID",
      code: `const id = '123e4567-e89b-12d3-a456-426614174000';`,
    },

    // ============================================
    // NUMBERS AND OTHER TYPES
    // ============================================
    {
      name: "number literal",
      code: `const port = 3000;`,
    },
    {
      name: "boolean literal",
      code: `const enabled = true;`,
    },
    {
      name: "null literal",
      code: `const value = null;`,
    },

    // ============================================
    // TEMPLATE LITERALS WITH EXPRESSIONS
    // ============================================
    {
      name: "template literal with expression",
      code: `const message = \`Hello \${name}\`;`,
    },
    {
      name: "template literal with multiple expressions",
      code: `const url = \`\${protocol}://\${host}:\${port}\`;`,
    },

    // ============================================
    // TEST FILES (when allowed)
    // ============================================
    {
      name: "test file with secret (when allowed)",
      code: `const testToken = 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';`,
      options: [{ allowInTestFiles: true }],
      filename: "auth.test.ts",
    },

    // ============================================
    // LOW ENTROPY SUSPICIOUS NAMES
    // ============================================
    {
      name: "suspicious name but low entropy value",
      code: `const apiKey = 'simple-test-value';`,
    },
    {
      name: "password with common value",
      code: `const password = 'password123';`,
    },
  ],

  invalid: [
    // ============================================
    // AWS CREDENTIALS
    // ============================================
    {
      name: "AWS Access Key ID",
      code: `const accessKeyId = 'AKIAIOSFODNN7EXAMPLE';`,
      errors: [{ messageId: "secretDetected" }],
    },

    // ============================================
    // GITHUB TOKENS
    // ============================================
    {
      name: "GitHub Personal Access Token",
      code: `const token = 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';`,
      errors: [{ messageId: "secretDetected" }],
    },
    {
      name: "GitHub OAuth Token",
      code: `const token = 'gho_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';`,
      errors: [{ messageId: "secretDetected" }],
    },

    // ============================================
    // STRIPE KEYS
    // ============================================
    {
      name: "Stripe Live Secret Key",
      code: `const stripeKey = 'sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx';`,
      errors: [{ messageId: "secretDetected" }],
    },
    {
      name: "Stripe Test Secret Key",
      code: `const stripeKey = 'sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxx';`,
      errors: [{ messageId: "secretDetected" }],
    },

    // ============================================
    // GOOGLE API KEYS
    // ============================================
    {
      name: "Google API Key",
      code: `const googleKey = 'AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';`,
      errors: [{ messageId: "secretDetected" }],
    },

    // ============================================
    // SLACK TOKENS
    // ============================================
    {
      name: "Slack Bot Token",
      code: `const slackToken = 'xoxb-123456789012-123456789012-abcdefghijklmnopqrstuvwx';`,
      errors: [{ messageId: "secretDetected" }],
    },

    // ============================================
    // NPM TOKENS
    // ============================================
    {
      name: "npm Token",
      code: `const npmToken = 'npm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';`,
      errors: [{ messageId: "secretDetected" }],
    },

    // ============================================
    // JWT TOKENS
    // ============================================
    {
      name: "JWT Token",
      code: `const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';`,
      errors: [{ messageId: "secretDetected" }],
    },

    // ============================================
    // PRIVATE KEYS
    // ============================================
    {
      name: "RSA Private Key",
      code: `const privateKey = '-----BEGIN RSA PRIVATE KEY-----\\nMIIEpAIBAAKCAQEA...\\n-----END RSA PRIVATE KEY-----';`,
      errors: [{ messageId: "secretDetected" }],
    },
    {
      name: "Private Key (generic)",
      code: `const key = '-----BEGIN PRIVATE KEY-----';`,
      errors: [{ messageId: "secretDetected" }],
    },

    // ============================================
    // ANTHROPIC/OPENAI KEYS
    // ============================================
    {
      name: "Anthropic API Key",
      code: `const anthropicKey = 'sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxx';`,
      errors: [{ messageId: "secretDetected" }],
    },
    {
      name: "OpenAI API Key (new format)",
      code: `const openaiKey = 'sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';`,
      errors: [{ messageId: "secretDetected" }],
    },

    // ============================================
    // SUSPICIOUS VARIABLE NAMES
    // ============================================
    {
      name: "suspicious variable - apiKey with high entropy",
      code: `const apiKey = 'xK9mP2qL5nR8vT3wY6zA1bC4dE7fG0hI';`,
      errors: [{ messageId: "suspiciousVariable" }],
    },
    {
      name: "suspicious variable - password with high entropy",
      code: `const password = 'Qw3rT5yU7iO9pA1sD3fG5hJ7kL9zX1cV';`,
      errors: [{ messageId: "suspiciousVariable" }],
    },
    {
      name: "suspicious variable - secret with high entropy",
      code: `const secret = 'mN2bV4cX6zL8kJ0hG9fD7sA5qW3eR1tY';`,
      errors: [{ messageId: "suspiciousVariable" }],
    },
    {
      name: "suspicious variable - auth_token with high entropy",
      code: `const auth_token = 'aB3cD5eF7gH9iJ1kL3mN5oP7qR9sT1uV';`,
      errors: [{ messageId: "suspiciousVariable" }],
    },

    // ============================================
    // MULTIPLE SECRETS
    // ============================================
    {
      name: "multiple secrets in same file",
      code: `
        const github = 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
        const stripe = 'sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx';
      `,
      errors: [
        { messageId: "secretDetected" },
        { messageId: "secretDetected" },
      ],
    },

    // ============================================
    // SECRETS IN OBJECTS
    // ============================================
    {
      name: "secret in object property",
      code: `const config = { token: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' };`,
      errors: [{ messageId: "secretDetected" }],
    },
    {
      name: "secret in array",
      code: `const tokens = ['ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'];`,
      errors: [{ messageId: "secretDetected" }],
    },

    // ============================================
    // TEMPLATE LITERALS (pure string)
    // ============================================
    {
      name: "secret in pure template literal",
      code: "const token = `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`;",
      errors: [{ messageId: "secretDetected" }],
    },

    // ============================================
    // CUSTOM PATTERNS
    // ============================================
    {
      name: "custom pattern match",
      code: `const key = 'myapi_abcdefghijklmnopqrstuvwxyz123456';`,
      options: [
        {
          additionalPatterns: [
            { name: "My Custom API", pattern: "^myapi_[a-z0-9]{32}$" },
          ],
        },
      ],
      errors: [{ messageId: "secretDetected" }],
    },
  ],
});
