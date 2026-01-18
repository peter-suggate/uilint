"use client";

import { useState, useEffect, useCallback } from "react";

type AsyncState<T> =
  | { status: "idle"; data: null; error: null }
  | { status: "pending"; data: null; error: null }
  | { status: "success"; data: T; error: null }
  | { status: "error"; data: null; error: Error };

/**
 * Alternative async data fetching hook using discriminated union pattern
 * NOTE: Same core logic as useDataFetching but different state structure
 */
export function useAsync<T>(
  asyncFn: () => Promise<T>,
  immediate = true
): AsyncState<T> & { execute: () => Promise<void> } {
  const [state, setState] = useState<AsyncState<T>>({
    status: "idle",
    data: null,
    error: null,
  });

  const execute = useCallback(async () => {
    setState({ status: "pending", data: null, error: null });
    try {
      const result = await asyncFn();
      setState({ status: "success", data: result, error: null });
    } catch (err) {
      setState({
        status: "error",
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }, [asyncFn]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  return { ...state, execute };
}

/**
 * Hook for managing list data with pagination using discriminated unions
 * NOTE: Similar logic to usePaginatedData but different interface
 */
export function usePagedList<T>(
  loader: (offset: number, limit: number) => Promise<{ data: T[]; count: number }>,
  limit = 10
) {
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<T[]>([]);
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchPage = async () => {
      setStatus("loading");
      try {
        const response = await loader(offset, limit);
        setData(response.data);
        setCount(response.count);
        setStatus("ready");
        setErrorMsg(null);
      } catch (e) {
        setStatus("failed");
        setErrorMsg(e instanceof Error ? e.message : "Unknown error");
      }
    };
    fetchPage();
  }, [offset, limit, loader]);

  return {
    data,
    count,
    status,
    errorMsg,
    offset,
    limit,
    pages: Math.ceil(count / limit),
    goToPage: (p: number) => setOffset(p * limit),
    nextPage: () => setOffset((o) => Math.min(o + limit, count - limit)),
    prevPage: () => setOffset((o) => Math.max(0, o - limit)),
  };
}
