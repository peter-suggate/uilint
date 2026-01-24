# React Style Guide Generator

Analyze the React UI codebase to produce a **prescriptive, semantic** style guide. Focus on consistency, intent, and relationships—not specific values.

## Philosophy

1. **Identify the intended architecture** from the best patterns in use
2. **Prescribe semantic rules** — about consistency and relationships, not pixels
3. **Stay general** — "primary buttons should be visually consistent" not "buttons use px-4"
4. **Focus on intent** — what should FEEL the same, not what values to use

## Analysis Steps

### 1. Detect the Stack
- Framework: Next.js (App Router? Pages?), Vite, CRA
- Component system: shadcn, MUI, Chakra, Radix, custom
- Styling: Tailwind, CSS Modules, styled-components
- Forms: react-hook-form, Formik, native
- State: React context, Zustand, Redux, Jotai

### 2. Identify Best Patterns
Examine the **best-written** components. Look at:
- `components/ui/*` — the design system
- Recently modified files — current standards
- Shared layouts — structural patterns

### 3. Infer Visual Hierarchy & Intent
Understand the design language:
- What distinguishes primary vs secondary actions?
- How is visual hierarchy established?
- What creates consistency across similar elements?

## Output Format

Generate at `<workspaceroot>/.uilint/styleguide.md`:
```yaml
# Stack
framework: 
styling: 
components: 
component_path: 
forms: 

# Component Usage (MUST use these)
use:
  buttons: 
  inputs: 
  modals: 
  cards: 
  feedback: 
  icons: 
  links: 

# Semantic Rules (consistency & relationships)
semantics:
  hierarchy:
    - <e.g., "primary actions must be visually distinct from secondary">
    - <e.g., "destructive actions should be visually cautionary">
    - <e.g., "page titles should be visually heavier than section titles">
  consistency:
    - <e.g., "all primary buttons should share the same visual weight">
    - <e.g., "form inputs should have uniform height and padding">
    - <e.g., "card padding should be consistent across the app">
    - <e.g., "interactive elements should have consistent hover/focus states">
  spacing:
    - <e.g., "use the spacing scale — no arbitrary values">
    - <e.g., "related elements should be closer than unrelated">
    - <e.g., "section spacing should be larger than element spacing">
  layout:
    - <e.g., "use gap for sibling spacing, not margin">
    - <e.g., "containers should have consistent max-width and padding">

# Patterns (structural, not values)
patterns:
  forms: <e.g., "FormField + Controller + zod schema">
  conditionals: <e.g., "cn() for class merging">
  loading: <e.g., "Skeleton for content, Spinner for actions">
  errors: <e.g., "ErrorBoundary at route, inline for forms">
  responsive: <e.g., "mobile-first, standard breakpoints only">

# Component Authoring
authoring:
  - <e.g., "forwardRef for interactive components">
  - <e.g., "variants via CVA or component props, not className overrides">
  - <e.g., "extract when used 2+ times">
  - <e.g., "'use client' only when needed">

# Forbidden
forbidden:
  - <e.g., "inline style={{}}">
  - <e.g., "raw HTML elements when component exists">
  - <e.g., "arbitrary values — use scale">
  - <e.g., "className overrides that break visual consistency">
  - <e.g., "one-off spacing that doesn't match siblings">

# Legacy (if migration in progress)
legacy:
  - <e.g., "old: CSS modules → new: Tailwind">
  - <e.g., "old: Formik → new: react-hook-form">

# Conventions
conventions:
  - 
  - 
  - 
```

## Rules

- **Semantic over specific**: "consistent padding" not "p-4"
- **Relationships over absolutes**: "heavier than" not "font-bold"
- **Intent over implementation**: "visually distinct" not "blue background"
- **Prescriptive**: Define target state, not current state
- **Terse**: No prose. Fragments and short phrases only.
- **Actionable**: Every rule should be human-verifiable
- **Omit if N/A**: Skip sections that don't apply
- **Max 5 items** per section — highest impact only
