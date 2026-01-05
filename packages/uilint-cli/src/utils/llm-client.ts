/**
 * LLM Client Factory with Optional Langfuse Instrumentation
 *
 * This module provides a centralized way to create OllamaClient instances
 * with optional Langfuse tracing enabled. Langfuse is only loaded if:
 *   1. LANGFUSE_ENABLED=1 (or true/yes)
 *   2. LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY are set
 */

import { config } from "dotenv";
import { join } from "path";
import {
  OllamaClient,
  type LLMInstrumentationCallbacks,
  type InstrumentationSpan,
  findWorkspaceRoot,
} from "uilint-core/node";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import {
  startActiveObservation,
  startObservation,
  type LangfuseObservation,
  type LangfuseGeneration,
} from "@langfuse/tracing";

// Load .env.local from workspace root
let envLoaded = false;
function loadEnvLocal(): void {
  if (envLoaded) return;
  envLoaded = true;

  const workspaceRoot = findWorkspaceRoot(process.cwd());
  const envLocalPath = join(workspaceRoot, ".env.local");

  // Load .env.local if it exists (dotenv will silently skip if file doesn't exist)
  config({ path: envLocalPath });
}

// Load environment variables immediately on module load
loadEnvLocal();

// Lazy-loaded instrumentation
let langfuseInitialized = false;
let langfuseInstrumentation: LLMInstrumentationCallbacks | undefined;
let sdkInstance: NodeSDK | undefined;
let spanProcessor: LangfuseSpanProcessor | undefined;

/**
 * Checks if Langfuse is enabled via environment variable
 */
function isLangfuseEnabled(): boolean {
  const enabled = process.env.LANGFUSE_ENABLED;
  if (!enabled) return false;
  return (
    enabled === "1" ||
    enabled.toLowerCase() === "true" ||
    enabled.toLowerCase() === "yes"
  );
}

/**
 * Initialize Langfuse if enabled. This is called automatically on first client creation,
 * but can also be called explicitly at app startup.
 */
export async function initializeLangfuseIfEnabled(): Promise<void> {
  if (langfuseInitialized) return;
  langfuseInitialized = true;

  if (!isLangfuseEnabled()) {
    return;
  }

  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;

  if (!publicKey || !secretKey) {
    console.error(
      "[uilint] LANGFUSE_ENABLED=1 but missing LANGFUSE_PUBLIC_KEY or LANGFUSE_SECRET_KEY"
    );
    return;
  }

  try {
    const baseUrl = process.env.LANGFUSE_BASE_URL || "http://localhost:3333";

    // Create the span processor with immediate export mode for CLI usage
    spanProcessor = new LangfuseSpanProcessor({
      publicKey,
      secretKey,
      baseUrl,
      // Use immediate mode to ensure spans are exported right away in CLI context
      exportMode: "immediate",
    });

    // Initialize OpenTelemetry with LangfuseSpanProcessor
    const sdk = new NodeSDK({
      spanProcessors: [spanProcessor],
    });

    sdk.start();
    sdkInstance = sdk;

    // Create instrumentation callbacks using @langfuse/tracing
    // Use startActiveObservation at top level to create the trace context
    langfuseInstrumentation = {
      onGenerationStart: ({
        name,
        model,
        prompt,
        metadata,
      }: {
        name: string;
        model: string;
        prompt: string;
        metadata?: Record<string, unknown>;
      }): InstrumentationSpan => {
        // We need to bridge the callback-based startActiveObservation with our
        // synchronous start / async end pattern. Use a promise to control when the trace ends.
        let resolveTrace: () => void;
        let generationRef: LangfuseGeneration | undefined;
        let traceRef: LangfuseObservation | undefined;
        let endData:
          | {
              output: string;
              usage?: {
                promptTokens?: number;
                completionTokens?: number;
                totalTokens?: number;
                error?: string;
              };
            }
          | undefined;

        // Start the active observation (trace) - this runs the callback immediately
        // but doesn't resolve until we call resolveTrace()
        const tracePromise = startActiveObservation(
          `uilint-${name}`,
          async (span) => {
            traceRef = span;
            span.update({
              input: { operation: name },
              metadata: {
                ...metadata,
                source: "uilint-cli",
              },
            });

            // Create the generation as a child - startObservation within startActiveObservation
            // automatically nests under the active trace
            generationRef = startObservation(
              name,
              {
                model,
                input: prompt,
                metadata: {
                  ...metadata,
                  source: "uilint-cli",
                },
              },
              { asType: "generation" }
            );

            // Wait for end() to be called before completing the trace
            await new Promise<void>((resolve) => {
              resolveTrace = resolve;
            });

            // Now process the end data
            if (endData && generationRef) {
              const usageDetails: Record<string, number> | undefined =
                endData.usage
                  ? Object.fromEntries(
                      Object.entries({
                        input: endData.usage.promptTokens,
                        output: endData.usage.completionTokens,
                        total: endData.usage.totalTokens,
                      }).filter(([, v]) => v !== undefined) as [
                        string,
                        number
                      ][]
                    )
                  : undefined;

              // End the generation
              generationRef.update({
                output: endData.output,
                usageDetails:
                  usageDetails && Object.keys(usageDetails).length > 0
                    ? usageDetails
                    : undefined,
                metadata: endData.usage?.error
                  ? { ...metadata, error: endData.usage.error }
                  : metadata,
              });
              generationRef.end();

              // Update the trace output
              span.update({
                output: endData.usage?.error
                  ? `Error: ${endData.usage.error}`
                  : "completed",
              });
            }
            // The trace automatically ends when the callback completes
          }
        );

        // Handle any errors from the trace promise
        tracePromise.catch((error) => {
          console.error("[uilint] Langfuse trace error:", error);
        });

        return {
          end: (
            output: string,
            usage?: {
              promptTokens?: number;
              completionTokens?: number;
              totalTokens?: number;
              error?: string;
            }
          ) => {
            // Store the end data and resolve the trace promise
            endData = { output, usage };
            if (resolveTrace) {
              resolveTrace();
            }
          },
        };
      },
    };

    console.error(`[uilint] Langfuse tracing enabled (${baseUrl})`);
  } catch (error) {
    console.error(
      "[uilint] Failed to initialize Langfuse:",
      error instanceof Error ? error.message : error
    );
  }
}

/**
 * Creates an OllamaClient with optional Langfuse instrumentation.
 * Automatically initializes Langfuse on first call if enabled.
 */
export async function createLLMClient(options: {
  model?: string;
  baseUrl?: string;
  timeout?: number;
}): Promise<OllamaClient> {
  // Initialize Langfuse on first client creation
  await initializeLangfuseIfEnabled();

  return new OllamaClient({
    ...options,
    instrumentation: langfuseInstrumentation,
  });
}

/**
 * Flushes Langfuse traces. Call this before process exit to ensure all traces are sent.
 */
export async function flushLangfuse(): Promise<void> {
  // Force flush the span processor first to ensure all pending spans are sent
  if (spanProcessor) {
    try {
      await spanProcessor.forceFlush();
    } catch (error) {
      console.error(
        "[uilint] Failed to flush Langfuse spans:",
        error instanceof Error ? error.message : error
      );
    }
  }

  // Then shutdown the SDK
  if (sdkInstance) {
    try {
      await sdkInstance.shutdown();
    } catch (error) {
      console.error(
        "[uilint] Failed to shutdown OpenTelemetry SDK:",
        error instanceof Error ? error.message : error
      );
    }
  }
}

/**
 * Returns true if Langfuse is currently initialized and active.
 */
export function isLangfuseActive(): boolean {
  return spanProcessor !== undefined;
}

// Register shutdown handler
let shutdownRegistered = false;
function registerShutdownHandler(): void {
  if (shutdownRegistered) return;
  shutdownRegistered = true;

  const cleanup = async () => {
    await flushLangfuse();
  };

  process.on("beforeExit", cleanup);
  process.on("SIGINT", async () => {
    await cleanup();
    process.exit(130);
  });
  process.on("SIGTERM", async () => {
    await cleanup();
    process.exit(143);
  });
}

// Auto-register on module load
registerShutdownHandler();
