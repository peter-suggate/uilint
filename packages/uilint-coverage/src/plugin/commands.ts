import type { CommandDefinition } from "uilint-core";

export const coverageCommands: CommandDefinition[] = [
  {
    id: "coverage:regenerate",
    title: "Regenerate Coverage Data",
    keywords: ["coverage", "test", "regenerate", "rebuild"],
    category: "Coverage",
    subtitle: "Run tests and regenerate coverage data",
    icon: "refresh",
    action: { type: "start-preparation" },
  },
];
