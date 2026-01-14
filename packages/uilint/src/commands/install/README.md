# Install Command

This directory contains the `uilint install` command with an interactive Ink-based UI.

## Architecture

### Directory Structure

```
install/
├── analyze.ts              # Project scanning (phase 1)
├── plan.ts                 # Plan generation (phase 2)
├── execute.ts              # Side effect execution (phase 3)
├── types.ts                # Shared types
├── constants.ts            # Constants (file templates, etc.)
│
├── installers/             # Pluggable installers
│   ├── types.ts           # Installer interface
│   ├── registry.ts        # Installer registry
│   ├── index.ts           # Auto-registration
│   ├── genstyleguide.ts   # /genstyleguide command installer
│   ├── skill.ts           # Agent skill installer
│   ├── eslint.ts          # ESLint plugin installer
│   ├── next-overlay.ts    # Next.js overlay installer
│   └── vite-overlay.ts    # Vite overlay installer
│
└── components/             # Ink React components
    ├── InstallApp.tsx     # Main state machine
    ├── MultiSelect.tsx    # Configuration selector
    ├── ProgressList.tsx   # Progress tracking UI
    └── Spinner.tsx        # Loading spinner
```

## Installer Plugin System

Each installer implements the `Installer` interface:

```typescript
interface Installer {
  id: string;                // Unique ID (e.g., "eslint")
  name: string;              // Display name
  description: string;       // Description shown in UI
  icon?: string;             // Optional emoji

  // Detection
  isApplicable(project: ProjectState): boolean;
  getTargets(project: ProjectState): InstallTarget[];

  // Configuration (optional)
  configure?(targets: InstallTarget[], project: ProjectState): Promise<InstallerConfig>;

  // Execution
  plan(targets, config, project): { actions, dependencies };
  execute(targets, config, project): AsyncGenerator<ProgressEvent>;
}
```

### Adding a New Installer

1. Create `installers/my-feature.ts`:

```typescript
import type { Installer } from "./types.js";

export const myFeatureInstaller: Installer = {
  id: "my-feature",
  name: "My Feature",
  description: "Does something cool",
  icon: "🚀",

  isApplicable(project) {
    // Return true if this installer applies to the project
    return project.packages.length > 0;
  },

  getTargets(project) {
    // Return array of installation targets
    return project.packages.map(pkg => ({
      id: `my-feature-${pkg.name}`,
      label: pkg.name,
      path: pkg.path,
      isInstalled: false,
    }));
  },

  plan(targets, config, project) {
    // Generate actions and dependencies
    const actions = [
      { type: "create_file", path: "...", content: "..." }
    ];
    return { actions, dependencies: [] };
  },

  async *execute(targets, config, project) {
    yield { type: "start", message: "Installing my feature" };
    yield { type: "progress", message: "Doing stuff...", detail: "→ details" };
    yield { type: "complete", message: "Installed!" };
  },
};
```

2. Register in `installers/index.ts`:

```typescript
import { myFeatureInstaller } from "./my-feature.js";
registerInstaller(myFeatureInstaller);
```

3. Done! The installer will automatically appear in the UI.

## State Machine Flow

```
SCANNING
  ↓
  Analyze project (packages, Next apps, Vite apps, ESLint configs)
  ↓
CONFIGURING
  ↓
  ConfigSelector (grouped features, toggle selection)
  ↓
EXECUTING
  ↓
  Run installers, show ProgressList
  ↓
COMPLETE
```

## Usage

```bash
# Interactive configuration dashboard
uilint install

# Force overwrite existing files
uilint install --force
```

The installer shows a configuration dashboard with:
- Detected project context (package manager, frameworks, configs)
- Features grouped by category
- Installation status for each feature
- Keyboard navigation (↑↓ navigate, space toggle, a=all, n=none, enter apply, q quit)

## Benefits

### For Users

- **Clarity**: See what was detected before choosing what to install
- **Progress**: Granular feedback during installation
- **Flexibility**: Multi-select interface, choose multiple targets at once

### For Developers

- **Extensibility**: Adding a new installer = one file + registration
- **Testability**: Installers are pure functions with clear interfaces
- **Maintainability**: Separation of concerns (detection, planning, execution)

## Testing

```bash
# Run installer tests
pnpm --filter uilint test test/unit/install

# Test UI manually
pnpm uilint install
```

## Components

### ConfigSelector

Configuration dashboard with:
- Items grouped by category
- Status indicators (installed, not installed, partial)
- Keyboard shortcuts for bulk selection
- Selection summary

### ProgressList

Live progress tracking with:
- Completed tasks (static, checkmark)
- Running task (spinner, detail line)
- Pending tasks (dimmed)

Uses Ink's `<Static>` component to avoid re-rendering completed items.

## Future Enhancements

- [ ] Rule selection UI for ESLint installer
- [ ] App selection when multiple Next.js/Vite apps detected
- [ ] Dry-run mode preview
- [ ] JSON output mode for CI
- [ ] Rollback support (undo installation)
- [ ] Progress persistence (resume failed installs)
