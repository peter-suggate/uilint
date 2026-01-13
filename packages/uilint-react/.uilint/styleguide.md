# uilint-react Devtool UI Style Guide

## Scope / Isolation

- All devtool UI must be rendered under a `.dev-tool-root` container.
- Tailwind output is scoped with `important: '.dev-tool-root'` to avoid leaking styles into host apps.

## Components

- Prefer **Cult UI** primitives for:
  - **Popover**: quick actions that close after interaction (settings, capture mode).
  - **Expandable**: persistent panels that should stay open while you interact with the page (issues lists).
  - **Code Block**: code previews in the inspector.

## Classnames

- Use the package `cn()` utility (`src/lib/utils.ts`) for Tailwind classes.
