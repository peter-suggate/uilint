# Feature Retirement Plan

This plan outlines the removal of three deprecated features: **genrules**, **hooks support**, and **MCP server**.

## Overview

### Features to Remove
1. **Genrules** - Cursor command for generating custom ESLint rules
2. **Hooks Support** - Cursor hooks integration for automatic file tracking and validation
3. **MCP Server** - Model Context Protocol server integration

### Goals
- Remove all code related to these features
- Simplify the installer
- Clean up dependencies
- Update documentation
- Ensure no breaking changes to core functionality

---

## 1. Genrules Removal

### Files to Delete Entirely
- None (all code is embedded in shared files)

### Code to Remove from Existing Files

#### `packages/uilint/src/commands/install/types.ts`
- Line 106: Remove `genrules: boolean;` from `ProjectState.commands`
- Line 127: Remove `"genrules"` from `InstallItem` union type
- Line 324: Remove `genrules?: boolean;` from `InstallOptions`

#### `packages/uilint/src/commands/install/constants.ts`
- Lines 315-415: Remove `GENRULES_COMMAND_MD` constant (entire template)

#### `packages/uilint/src/commands/install/analyze.ts`
- Line 102: Remove `const genrulesExists = existsSync(join(commandsDir, "genrules.md"));`
- Lines 189-190: Remove genrules state tracking

#### `packages/uilint/src/commands/install/plan.ts`
- Line 29: Remove `GENRULES_COMMAND_MD` import
- Line 134: Remove genrules check for `.cursor` directory creation
- Lines 249-265: Remove genrules command installation logic

#### `packages/uilint/src/commands/install/execute.ts`
- Line 518: Remove genrules detection in created files

#### `packages/uilint/src/commands/install/prompter.ts`
- Lines 128-131: Remove genrules CLI prompt option
- Line 415: Remove genrules flag check
- Line 425: Remove genrules from selected items

#### `packages/uilint/src/index.ts`
- Lines 180-182: Remove `--genrules` CLI option
- Line 203: Remove genrules from install function call

#### `packages/uilint/src/commands/install.ts`
- Lines 73-75: Remove genrules display in installation results

### Tests to Remove

#### `packages/uilint/test/unit/plan.test.ts`
- Line 51: Remove `genrules: false;` from mock
- Lines 306-315: Remove "creates genrules command" test
- Line 870: Remove from expectations

#### `packages/uilint/test/integration/install-skill.test.ts`
- Lines 219-239: Remove genrules from skill installation test
- Update test name to remove "and genrules commands"

#### `packages/uilint/test/helpers/prompts.ts`
- Line 154: Remove `"genrules"` from `acceptAllPrompter()`

---

## 2. Hooks Support Removal

### Directories to Delete Entirely
- `apps/test-app/.cursor/hooks/` (3 files)
- `packages/uilint/test/fixtures/has-cursor-hooks/` (directory)
- `packages/uilint/test/fixtures/has-legacy-hooks/` (directory)

### Files to Delete Entirely
- `apps/test-app/.cursor/hooks.json`
- `packages/uilint/test/integration/install-hooks.test.ts` (286 lines)

### Code to Remove from Existing Files

#### `packages/uilint/src/commands/install/types.ts`
- Lines 20-28: Remove `HooksConfig` interface
- Lines 88-95: Remove `hooks` from `ProjectState`
- Line 166: Remove `hooksMerge` from `UserChoices`

#### `packages/uilint/src/commands/install/constants.ts`
- Lines 13-20: Remove `HOOKS_CONFIG` constant
- Lines 35-38: Remove `LEGACY_HOOK_COMMANDS` constant
- Lines 44-190: Remove all hook scripts (`SESSION_START_SCRIPT`, `TRACK_SCRIPT`, `SESSION_END_SCRIPT`)

#### `packages/uilint/src/commands/install/analyze.ts`
- Line 37: Remove `LEGACY_HOOK_FILES` constant
- Lines 78-93: Remove hooks configuration detection logic

#### `packages/uilint/src/commands/install/plan.ts`
- Lines 73-108: Remove `mergeHooksConfig()` function
- Lines 175-229: Remove hooks installation planning logic

#### `packages/uilint/src/commands/install/prompter.ts`
- Lines 40-43: Remove `confirmHooksMerge()` method
- Lines 446-448: Remove hook merge confirmation prompt

#### `packages/uilint/src/commands/session.ts`
- **Delete entire file** (or remove if used only for hooks)
  - `sessionClear()` function (lines 69-75)
  - `sessionTrack()` function (lines 80-120)
  - `sessionScan()` function (lines 131-260)
  - `sessionList()` function (lines 265-268)

#### `packages/uilint/src/index.ts`
- Lines 174-201: Remove `--hooks` flag and mode option
- Lines 275-308: Remove session command registration
  - `session clear`
  - `session track`
  - `session scan`
  - `session list`

### Tests to Remove

#### `packages/uilint/test/unit/plan.test.ts`
- Line 190: Remove "creates hooks config and scripts when not exists" test
- Line 252: Remove "merges hooks when exists and hooksMerge=true" test

---

## 3. MCP Server Removal

### Directories to Delete Entirely
- `packages/uilint-mcp/` (entire package)
- `packages/uilint/test/fixtures/has-cursor-mcp/` (test fixture)

### Files to Delete Entirely
- `.cursor/mcp.json` (root config)
- `packages/uilint/test/integration/install-mcp.test.ts` (186 lines)

### Code to Remove from Existing Files

#### `packages/uilint/src/commands/install/types.ts`
- Lines 30-37: Remove `MCPConfig` interface
- Remove `mcp` property from `ProjectState`
- Remove `mcpMerge` from `UserChoices`
- Remove `mcp?: boolean` from `InstallOptions`
- Remove `"mcp"` from mode union type

#### `packages/uilint/src/commands/install/constants.ts`
- Lines 22-29: Remove `MCP_CONFIG` constant

#### `packages/uilint/src/commands/install/analyze.ts`
- Lines 74-76: Remove MCP config detection
- Lines 172-175: Remove MCP state from return

#### `packages/uilint/src/commands/install/plan.ts`
- Lines 145-170: Remove MCP installation logic

#### `packages/uilint/src/commands/install/prompter.ts`
- Lines 118-121: Remove "MCP Server" option
- Lines 143-150: Remove `confirmMcpMerge()` prompt
- Remove MCP handling from `gatherChoices()`

#### `packages/uilint/src/commands/install/execute.ts`
- Line 515: Remove MCP tracking in installed items

#### `packages/uilint/src/index.ts`
- Line 174-176: Remove MCP documentation
- Line 176: Remove `--mcp` CLI option
- Lines 193-195: Remove `--mode` option entirely (or simplify if used elsewhere)

#### `packages/uilint/src/commands/install.ts`
- Lines 55-56: Remove MCP Server display in results

#### `package.json` (root)
- Line 19: Remove `uilint-mcp` from build script
- Lines 35-36: Remove `uilint-mcp` from publish script

#### `README.md`
- Lines 40-50: Remove architecture diagram showing `uilint-mcp`
- Line 12: Update quick start to remove MCP mention
- Lines 29-36: Remove MCP workflow examples

---

## 4. Installation Command Simplification

### After Removal, the Installer Should Only Handle:
1. **Skill** - `.cursor/skills/uilint.skill/skill.md`
2. **Genstyleguide** - `.cursor/commands/genstyleguide.md`

### Updated User Flow
1. Run `npx uilint install`
2. Select which items to install (skill and/or genstyleguide)
3. No merge prompts needed (hooks/MCP removed)
4. Simple installation with fewer options

---

## 5. Execution Order

### Phase 1: Remove Tests (Safe First)
1. Delete test fixture directories
2. Delete integration test files
3. Remove test helper references
4. Run remaining tests to ensure no breakage

### Phase 2: Remove Feature Code
1. Delete entire packages (`uilint-mcp`, session command)
2. Remove constants (templates, configs)
3. Remove type definitions
4. Remove from analyze/plan/execute/prompter
5. Remove CLI options

### Phase 3: Update Documentation
1. Update README.md
2. Remove feature-specific documentation
3. Update package.json scripts

### Phase 4: Cleanup & Verification
1. Remove empty imports
2. Fix any broken references
3. Run full test suite
4. Build all packages
5. Test install command manually

---

## 6. Risk Assessment

### Low Risk
- Genrules: Self-contained feature, minimal integration
- Test fixtures: Only used in tests

### Medium Risk
- Hooks: More integrated, session command removal
- Install command changes: Core functionality changes

### High Risk
- MCP Server: Entire package removal, affects monorepo build

### Mitigation
- Delete in phases
- Run tests after each phase
- Keep git commits granular for easy rollback

---

## 7. Estimated Impact

### Files Modified: ~15-20 files
### Files Deleted: ~10-15 files
### Lines Removed: ~1500-2000 lines
### Packages Removed: 1 (`uilint-mcp`)

### Simplified Install Options
**Before**: skill, genstyleguide, genrules, hooks, mcp (5 options)
**After**: skill, genstyleguide (2 options)

---

## Next Steps

1. ✅ Plan created and documented
2. ⏳ Get approval from team
3. ⏳ Execute removal in phases
4. ⏳ Update changelog/migration guide
5. ⏳ Publish new version
