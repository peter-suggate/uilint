/**
 * Validate command - validates code against style guide
 */

import ora from "ora";
import {
  readStyleGuide,
  readStyleGuideFromProject,
  validateCodeWithOptions,
} from "uilint-core/node";
import { existsSync } from "fs";
import { getCodeInput } from "../utils/input.js";
import {
  formatValidationIssues,
  printJSON,
  printError,
  printSuccess,
} from "../utils/output.js";

export interface ValidateOptions {
  code?: string;
  file?: string;
  styleguide?: string;
  output?: "text" | "json";
  model?: string;
  llm?: boolean;
}

export async function validate(options: ValidateOptions): Promise<void> {
  const spinner = ora("Validating code...").start();

  try {
    // Get code input
    const code = await getCodeInput({
      code: options.code,
      file: options.file,
    });

    // Get style guide
    const projectPath = process.cwd();
    let styleGuide: string | null = null;
    if (options.styleguide) {
      // `--styleguide` is documented as a path to a style guide file.
      // Historically we treated it as a project dir; that can silently return null
      // and cause the LLM validator to hallucinate "not in the style guide" issues.
      if (existsSync(options.styleguide)) {
        styleGuide = await readStyleGuide(options.styleguide);
      } else {
        // Fallback: treat as a project directory.
        styleGuide = await readStyleGuideFromProject(options.styleguide);
      }
    } else {
      styleGuide = await readStyleGuideFromProject(projectPath);
    }

    if (options.llm) {
      spinner.text = "Validating with LLM...";
    }

    const result = await validateCodeWithOptions(code, styleGuide, {
      llm: options.llm,
      model: options.model,
    });

    spinner.stop();

    // Output results
    if (options.output === "json") {
      printJSON(result);
    } else {
      console.log(formatValidationIssues(result.issues));
      if (result.valid) {
        printSuccess("Code passes validation");
      }
    }

    // Exit with error code if not valid
    if (!result.valid) {
      process.exit(1);
    }
  } catch (error) {
    spinner.fail("Validation failed");
    printError(error instanceof Error ? error.message : "Unknown error");
    process.exit(1);
  }
}
