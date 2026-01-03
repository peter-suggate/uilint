# Stack

framework: Next.js App Router
styling: Tailwind CSS v4
components: custom
component_path: app/components
forms: native

# Component Usage (MUST use these)

use:
buttons: PrimaryButton, SecondaryButton, OutlineButton from app/components/buttons
inputs:
modals:
cards: Card from app/components/cards
feedback:
icons:
links:

# Semantic Rules (consistency & relationships)

semantics:
hierarchy: - primary actions must be visually distinct from secondary actions - page titles should be visually heavier than section titles - headings should establish clear visual hierarchy
consistency: - all primary buttons should share the same visual weight and color - card padding should be consistent across the app - interactive elements should have consistent hover/focus states - typography components should maintain consistent color relationships
spacing: - use the spacing scale — no arbitrary values - related elements should be closer than unrelated - section spacing should be larger than element spacing
layout: - use gap for sibling spacing, not margin - containers should have consistent max-width and padding - use space-y for vertical spacing between related elements

# Patterns (structural, not values)

patterns:
forms:
conditionals: className prop for conditional styling overrides
loading:
errors:
responsive: mobile-first, standard breakpoints only

# Component Authoring

authoring:

- extend HTML element props (e.g., ButtonHTMLAttributes)
- accept className prop for styling overrides
- extract when used 2+ times
- 'use client' only when needed

# Forbidden

forbidden:

- inline style={{}}
- raw HTML elements when component exists (e.g., button instead of PrimaryButton)
- arbitrary values — use Tailwind scale
- className overrides that break visual consistency
- one-off spacing that doesn't match siblings
- similar colors that should be consolidated (e.g., blue-500 vs blue-600)

# Legacy (if migration in progress)

legacy:

# Conventions

conventions:

- use transition-colors for hover states on interactive elements
- use semantic component names (PrimaryButton, not BlueButton)
- maintain consistent border radius across similar components
- use consistent shadow values for elevation
