# Adding a Rule to the Registry

After creating your rule, you must register it in `packages/uilint-eslint/src/rule-registry.ts`.

## Entry Format

```typescript
{
  id: "rule-name",                    // Must match filename (without .ts)
  name: "Human Readable Name",        // Display name for CLI
  description: "Short description",   // Shown in rule selection prompts
  defaultSeverity: "warn",            // "error" | "warn" | "off"
  defaultOptions: [{ ... }],          // Default configuration
  optionSchema: {                     // For interactive configuration
    fields: [
      {
        key: "optionKey",             // Property name in options object
        label: "Prompt Label",        // Shown in CLI prompts
        type: "text",                 // "text" | "number" | "boolean" | "select" | "multiselect"
        defaultValue: "default",      // Pre-filled value
        placeholder: "hint text",     // For text/number inputs
        options: [                    // For select/multiselect
          { value: "a", label: "Option A" },
          { value: "b", label: "Option B" },
        ],
        description: "Help text",     // Explains the option
      },
    ],
  },
  requiresStyleguide: false,          // true if needs .uilint/styleguide.md
  category: "static",                 // "static" | "semantic"
},
```

## Field Types

### text
For string values:
```typescript
{
  key: "importSource",
  label: "Import path for component",
  type: "text",
  defaultValue: "@/components/ui/button",
  placeholder: "@/components/ui/button",
  description: "The module path to import the preferred component from",
}
```

### number
For numeric values:
```typescript
{
  key: "maxCount",
  label: "Maximum allowed count",
  type: "number",
  defaultValue: 3,
  placeholder: "3",
  description: "Maximum number of items before triggering warning",
}
```

### boolean
For on/off toggles:
```typescript
{
  key: "strict",
  label: "Enable strict mode",
  type: "boolean",
  defaultValue: false,
  description: "When enabled, also checks for edge cases",
}
```

### select
For single-choice options:
```typescript
{
  key: "preferred",
  label: "Preferred component library",
  type: "select",
  defaultValue: "shadcn",
  options: [
    { value: "shadcn", label: "shadcn/ui" },
    { value: "mui", label: "Material UI" },
    { value: "chakra", label: "Chakra UI" },
  ],
  description: "The UI library to enforce",
}
```

### multiselect
For multiple-choice options:
```typescript
{
  key: "elements",
  label: "Elements to check",
  type: "multiselect",
  defaultValue: ["button", "input"],
  options: [
    { value: "button", label: "Button" },
    { value: "input", label: "Input" },
    { value: "select", label: "Select" },
    { value: "textarea", label: "Textarea" },
  ],
  description: "HTML elements to enforce replacement for",
}
```

## Complete Example

Here's a complete registry entry for a rule that enforces design system buttons:

```typescript
{
  id: "prefer-design-system-button",
  name: "Prefer Design System Button",
  description: "Enforce using Button from design system instead of native <button>",
  defaultSeverity: "warn",
  defaultOptions: [
    {
      preferred: "Button",
      importSource: "@/components/ui/button",
      checkSubmit: true,
    },
  ],
  optionSchema: {
    fields: [
      {
        key: "preferred",
        label: "Preferred component name",
        type: "text",
        defaultValue: "Button",
        placeholder: "Button",
        description: "The component to use instead of native button",
      },
      {
        key: "importSource",
        label: "Import path",
        type: "text",
        defaultValue: "@/components/ui/button",
        placeholder: "@/components/ui/button",
        description: "Where to import the component from",
      },
      {
        key: "checkSubmit",
        label: "Check submit buttons",
        type: "boolean",
        defaultValue: true,
        description: "Also check button[type='submit']",
      },
    ],
  },
  requiresStyleguide: false,
  category: "static",
},
```

## After Adding Entry

1. Run `pnpm -C packages/uilint-eslint generate:index` to regenerate the index
2. The rule will now appear in `uilint install` prompts
3. Users can configure it interactively during installation
