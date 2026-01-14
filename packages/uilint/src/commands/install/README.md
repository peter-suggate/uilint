# Install Command Redesign

This directory contains the redesigned `uilint install` command with improved UX and extensibility.

## Architecture

### Two Install Flows

1. **Legacy Flow** (`install.ts`) - Original @clack/prompts-based installer
   - Used when CLI flags are provided (`--eslint`, `--routes`, etc.)
   - Maintained for backwards compatibility
   - Will be deprecated in future versions

2. **New Flow** (`install-ui.tsx`) - Ink-based installer with rich UI
   - Used when `--ui` flag is provided OR no flags (interactive mode)
   - Project-first: Shows detected apps/packages before asking what to install
   - Granular progress indicators
   - Extensible plugin architecture

### Directory Structure

```
install/
├── analyze.ts              # Project scanning (phase 1)
├── plan.ts                 # Plan generation (phase 2)
├── execute.ts              # Side effect execution (phase 3)
├── types.ts                # Shared types
├── constants.ts            # Constants (file templates, etc.)
├── prompter.ts             # Legacy prompt abstraction
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
    ├── ProjectSummary.tsx # Project detection display
    ├── FeatureSelector.tsx # Multi-select UI
    └── ProgressList.tsx   # Progress tracking UI
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
DISPLAYING
  ↓
  Show ProjectSummary (what was detected)
  ↓
SELECTING
  ↓
  FeatureSelector (multi-select installers)
  ↓
EXECUTING
  ↓
  Run installers, show ProgressList
  ↓
COMPLETE
```

## Usage

### Interactive Mode (Default)

```bash
# Default: beautiful configuration dashboard
uilint install

# Shows project detection, grouped features, keyboard navigation
```

### Legacy Flow

```bash
# Use legacy @clack/prompts installer
uilint install --legacy

# Non-interactive with specific flags (also uses legacy)
uilint install --eslint --routes
```

## Migration Notes

- The new Ink-based UI is now the default
- Use `--legacy` flag to access the old @clack/prompts installer
- Specific feature flags (`--eslint`, `--routes`, etc.) trigger legacy flow for backwards compatibility

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

# Test new UI manually
pnpm uilint install --ui
```

## Components

### ProjectSummary

Displays:
- Package manager
- Detected Next.js apps
- Detected Vite apps
- ESLint configs
- Already installed features

### FeatureSelector

Multi-select interface using `@inkjs/ui` MultiSelect component.

Features:
- Pre-selects non-installed items
- Shows hints for each option
- Keyboard navigation (↑↓, space, enter)

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
