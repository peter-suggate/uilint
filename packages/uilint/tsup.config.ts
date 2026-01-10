import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  banner: {
    js: "#!/usr/bin/env node",
  },
  // Mark Langfuse/OpenTelemetry as external - they use CommonJS internals
  // that don't work when bundled into ESM. These are optional dev dependencies.
  // Mark uilint-eslint as external - it contains @typescript-eslint/utils with
  // dynamic requires that don't work when bundled. It's installed as a dep anyway.
  external: [
    "@opentelemetry/sdk-node",
    "@langfuse/otel",
    "@langfuse/tracing",
    "@langfuse/client",
    "uilint-eslint",
  ],
});
