/**
 * Skill Loader Utility
 *
 * Loads Agent Skill files from the bundled skills directory for installation
 * into user projects. Skills follow the Agent Skills specification
 * (agentskills.io).
 */

import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, dirname, relative } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Represents a file in a skill directory
 */
export interface SkillFile {
  /** Relative path within the skill directory */
  relativePath: string;
  /** File content */
  content: string;
}

/**
 * Represents a complete skill ready for installation
 */
export interface Skill {
  /** Skill name (directory name) */
  name: string;
  /** All files in the skill */
  files: SkillFile[];
}

/**
 * Get the path to the bundled skills directory
 */
function getSkillsDir(): string {
  // In development: packages/uilint/skills/
  // In production (installed): node_modules/uilint/dist/ -> ../skills/
  const devPath = join(__dirname, "..", "..", "skills");
  const prodPath = join(__dirname, "..", "skills");

  if (existsSync(devPath)) {
    return devPath;
  }
  if (existsSync(prodPath)) {
    return prodPath;
  }

  throw new Error(
    "Could not find skills directory. This is a bug in uilint installation."
  );
}

/**
 * Recursively collect all files in a directory
 */
function collectFiles(dir: string, baseDir: string): SkillFile[] {
  const files: SkillFile[] = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...collectFiles(fullPath, baseDir));
    } else if (stat.isFile()) {
      const relativePath = relative(baseDir, fullPath);
      const content = readFileSync(fullPath, "utf-8");
      files.push({ relativePath, content });
    }
  }

  return files;
}

/**
 * Load a specific skill by name
 */
export function loadSkill(name: string): Skill {
  const skillsDir = getSkillsDir();
  const skillDir = join(skillsDir, name);

  if (!existsSync(skillDir)) {
    throw new Error(`Skill "${name}" not found in ${skillsDir}`);
  }

  const skillMdPath = join(skillDir, "SKILL.md");
  if (!existsSync(skillMdPath)) {
    throw new Error(`Skill "${name}" is missing SKILL.md`);
  }

  const files = collectFiles(skillDir, skillDir);

  return { name, files };
}

/**
 * Load all available skills
 */
export function loadAllSkills(): Skill[] {
  const skillsDir = getSkillsDir();
  const entries = readdirSync(skillsDir);
  const skills: Skill[] = [];

  for (const entry of entries) {
    const skillDir = join(skillsDir, entry);
    const stat = statSync(skillDir);

    if (stat.isDirectory()) {
      const skillMdPath = join(skillDir, "SKILL.md");
      if (existsSync(skillMdPath)) {
        skills.push(loadSkill(entry));
      }
    }
  }

  return skills;
}

/**
 * Get the list of available skill names
 */
export function getAvailableSkillNames(): string[] {
  const skillsDir = getSkillsDir();
  const entries = readdirSync(skillsDir);
  const names: string[] = [];

  for (const entry of entries) {
    const skillDir = join(skillsDir, entry);
    const stat = statSync(skillDir);

    if (stat.isDirectory()) {
      const skillMdPath = join(skillDir, "SKILL.md");
      if (existsSync(skillMdPath)) {
        names.push(entry);
      }
    }
  }

  return names;
}
