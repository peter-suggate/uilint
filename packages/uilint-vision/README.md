# uilint-vision

Vision analysis plugin for UILint. Provides AI-powered visual consistency checking using Ollama vision models.

## Installation

```bash
pnpm add uilint-vision
```

## Usage

### Browser (Client-Side)

Import browser utilities for screenshot capture and manifest collection:

```typescript
import {
  captureScreenshot,
  collectElementManifest,
  getCurrentRoute,
  matchIssuesToManifest,
} from "uilint-vision";
```

### Node.js (Server-Side)

Import the VisionAnalyzer for server-side analysis:

```typescript
import {
  VisionAnalyzer,
  getVisionAnalyzer,
  UILINT_DEFAULT_VISION_MODEL,
} from "uilint-vision/node";

// Create analyzer instance
const analyzer = new VisionAnalyzer({
  baseUrl: "http://localhost:11434",
  visionModel: UILINT_DEFAULT_VISION_MODEL,
});

// Analyze a screenshot
const result = await analyzer.analyzeScreenshot(
  imageBase64,
  elementManifest,
  { styleGuide: "..." }
);
```

### Plugin System

The vision plugin auto-registers with the UILint plugin registry:

```typescript
import "uilint-vision"; // Auto-registers plugin

import { pluginRegistry } from "uilint-core";
const visionPlugin = pluginRegistry.get("vision");
```

## Features

- **Screenshot Capture**: Full page and region-based capture
- **Element Manifest**: Collects data-loc elements for analysis mapping
- **Vision Analysis**: AI-powered visual consistency detection
- **Issue Matching**: Maps detected issues back to source code locations

## Types

Key types exported:

- `VisionIssue` - Detected visual issue
- `ElementManifest` - DOM element with data-loc
- `ScreenshotCapture` - Captured screenshot metadata
- `VisionAnalysisResult` - Analysis result with issues

## Browser Utilities

| Function | Description |
|----------|-------------|
| `captureScreenshot()` | Capture full page screenshot |
| `captureRegion(region)` | Capture specific region |
| `collectElementManifest()` | Collect data-loc elements |
| `getCurrentRoute()` | Get current browser route |
| `matchIssuesToManifest()` | Match issues to elements |
| `buildVisionAnalysisPayload()` | Build WebSocket message |

## Plugin Definition

The vision plugin provides:

- **Commands**: Capture full page, capture region, clear screenshots
- **Panels**: Vision issue inspector, screenshot gallery
- **Rules**: `semantic-vision` rule for ESLint integration
- **Toolbar**: Vision capture actions

## Requirements

- **Ollama**: Required for vision analysis (server-side)
- **Recommended Model**: `qwen3-vl:8b-instruct`

## License

MIT
