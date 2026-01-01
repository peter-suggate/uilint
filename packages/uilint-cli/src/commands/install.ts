/**
 * Install command - installs Cursor rules for UILint validation
 */

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { printSuccess, printError, printWarning } from "../utils/output.js";

export interface InstallOptions {
  force?: boolean;
}

const CURSOR_RULES_CONTENT = `---
description: UILint - Validate UI code against project styleguide
globs: ['**/*.tsx', '**/*.jsx', '**/*.css', '**/*.scss', '**/*.module.css']
alwaysApply: false
---

# UILint Validation

After modifying UI components (React components, CSS files, or styling), validate them against the project's styleguide.

## Validation Process

1. **After editing UI files**, run validation on the modified file:
   \`\`\`bash
   npx uilint-cli validate --file <path-to-modified-file>
   \`\`\`

2. **If validation fails**, fix the issues before completing the task:
   - Review the reported issues (colors, typography, spacing, etc.)
   - Update the code to match the styleguide
   - Re-run validation to confirm fixes

3. **If you need to understand the styleguide rules**, query them:
   \`\`\`bash
   npx uilint-cli query "what colors are allowed?"
   npx uilint-cli query "what spacing values should I use?"
   \`\`\`

4. **If introducing intentional new patterns**, update the styleguide:
   \`\`\`bash
   npx uilint-cli update --input-file <html-file>
   \`\`\`

## Style Guide Location

The project styleguide is located at \`.uilint/styleguide.md\`. This defines the allowed:
- Colors (primary, secondary, semantic colors)
- Typography (font families, sizes, weights)
- Spacing (grid system, common values)
- Component patterns (buttons, cards, etc.)

## Output Format

Use \`--output json\` for machine-readable output when needed:
\`\`\`bash
npx uilint-cli validate --file src/components/Button.tsx --output json
\`\`\`
`;

export async function install(options: InstallOptions): Promise<void> {
  try {
    const projectPath = process.cwd();
    const cursorRulesDir = join(projectPath, ".cursor", "rules");
    const ruleFilePath = join(cursorRulesDir, "uilint.mdc");

    // Check if rules file already exists
    if (!options.force && existsSync(ruleFilePath)) {
      printWarning(
        "Cursor rules file already exists at .cursor/rules/uilint.mdc"
      );
      console.log("Use --force to overwrite the existing file.");
      process.exit(1);
    }

    // Create .cursor/rules/ directory if it doesn't exist
    if (!existsSync(cursorRulesDir)) {
      mkdirSync(cursorRulesDir, { recursive: true });
    }

    // Write the rules file
    writeFileSync(ruleFilePath, CURSOR_RULES_CONTENT, "utf-8");

    printSuccess("Cursor rules installed at .cursor/rules/uilint.mdc");
    console.log(
      "\nThe Cursor agent will now validate UI code against your styleguide."
    );
    console.log("\nNext steps:");
    console.log("  1. Ensure you have a styleguide at .uilint/styleguide.md");
    console.log("     Run 'uilint init' to create one if needed");
    console.log("  2. Restart Cursor to load the new rules");
  } catch (error) {
    printError(
      error instanceof Error ? error.message : "Failed to install Cursor rules"
    );
    process.exit(1);
  }
}
