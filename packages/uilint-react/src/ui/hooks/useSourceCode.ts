/**
 * useSourceCode - Hook for fetching and caching source code
 *
 * Fetches source code via WebSocket and provides context lines
 * around a target line for the source viewer.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useComposedStore } from "../../core/store";
import { websocket } from "../../core/services/websocket";
import {
  getCachedSource,
  setCachedSource,
  extractContext,
  getPendingRequest,
  setPendingRequest,
  invalidateSource,
  type SourceContext,
  type CachedSourceFile,
} from "../../core/services/source-cache";

interface UseSourceCodeOptions {
  filePath: string;
  line: number;
  contextAbove?: number;
  contextBelow?: number;
  enabled?: boolean;
}

interface UseSourceCodeResult {
  context: SourceContext | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

interface SourceResultMessage {
  type: "source:result";
  filePath: string;
  content: string;
  totalLines: number;
  relativePath: string;
  requestId?: string;
}

interface SourceErrorMessage {
  type: "source:error";
  filePath: string;
  error: string;
  requestId?: string;
}

interface FileChangedMessage {
  type: "file:changed";
  filePath: string;
}

export function useSourceCode({
  filePath,
  line,
  contextAbove = 5,
  contextBelow = 5,
  enabled = true,
}: UseSourceCodeOptions): UseSourceCodeResult {
  const [context, setContext] = useState<SourceContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsConnected = useComposedStore((s) => s.wsConnected);
  const requestIdRef = useRef<string | null>(null);

  const fetchSource = useCallback(() => {
    if (!enabled || !filePath || !wsConnected) {
      return;
    }

    // Check cache first
    const cached = getCachedSource(filePath);
    if (cached) {
      setContext(extractContext(cached, line, contextAbove, contextBelow));
      setIsLoading(false);
      setError(null);
      return;
    }

    // Check for pending request (deduplication)
    const pending = getPendingRequest(filePath);
    if (pending) {
      setIsLoading(true);
      pending.then((result) => {
        if (result) {
          setContext(extractContext(result, line, contextAbove, contextBelow));
          setError(null);
        }
        setIsLoading(false);
      });
      return;
    }

    setIsLoading(true);
    setError(null);

    // Create a promise for this request
    const requestId = `source-${filePath}-${Date.now()}`;
    requestIdRef.current = requestId;

    const promise = new Promise<CachedSourceFile | null>((resolve) => {
      // Set up one-time handlers for this request
      const unsubResult = websocket.on<SourceResultMessage>(
        "source:result",
        (message) => {
          if (message.filePath === filePath) {
            const cached = setCachedSource(
              message.filePath,
              message.content,
              message.totalLines,
              message.relativePath
            );
            unsubResult();
            unsubError();
            resolve(cached);
          }
        }
      );

      const unsubError = websocket.on<SourceErrorMessage>(
        "source:error",
        (message) => {
          if (message.filePath === filePath) {
            setError(message.error);
            unsubResult();
            unsubError();
            resolve(null);
          }
        }
      );

      // Send the request
      websocket.send({
        type: "source:fetch",
        filePath,
        requestId,
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        unsubResult();
        unsubError();
        resolve(null);
      }, 10000);
    });

    setPendingRequest(filePath, promise);

    promise.then((result) => {
      if (result) {
        setContext(extractContext(result, line, contextAbove, contextBelow));
      }
      setIsLoading(false);
    });
  }, [filePath, line, contextAbove, contextBelow, enabled, wsConnected]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchSource();
  }, [fetchSource]);

  // Subscribe to file changes to invalidate cache
  useEffect(() => {
    if (!filePath) return;

    const unsubscribe = websocket.on<FileChangedMessage>(
      "file:changed",
      (message) => {
        // Check if the changed file matches our file path
        if (
          message.filePath === filePath ||
          message.filePath.endsWith(filePath) ||
          filePath.endsWith(message.filePath)
        ) {
          invalidateSource(filePath);
          // Refetch if we're still mounted and enabled
          if (enabled) {
            fetchSource();
          }
        }
      }
    );

    return unsubscribe;
  }, [filePath, enabled, fetchSource]);

  return { context, isLoading, error, refetch: fetchSource };
}
