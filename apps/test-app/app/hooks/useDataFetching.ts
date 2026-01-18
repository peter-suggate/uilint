"use client";

import { useState, useEffect, useCallback } from "react";

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Custom hook for fetching data with loading and error states
 * Used in dashboard and analytics pages
 */
export function useDataFetching<T>(
  fetchFn: () => Promise<T>,
  deps: unknown[] = []
): FetchState<T> & { refetch: () => void } {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const fetchData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await fetchFn();
      setState({ data: result, loading: false, error: null });
    } catch (err) {
      setState({
        data: null,
        loading: false,
        error: err instanceof Error ? err : new Error("Unknown error"),
      });
    }
  }, [fetchFn]);

  useEffect(() => {
    fetchData();
  }, [...deps, fetchData]);

  return { ...state, refetch: fetchData };
}

/**
 * Hook for fetching paginated data
 */
export function usePaginatedData<T>(
  fetchFn: (page: number, pageSize: number) => Promise<{ items: T[]; total: number }>,
  pageSize = 10
) {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const result = await fetchFn(page, pageSize);
        setItems(result.items);
        setTotal(result.total);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to fetch"));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [page, pageSize, fetchFn]);

  return {
    items,
    total,
    loading,
    error,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    setPage,
    hasNext: page * pageSize < total,
    hasPrev: page > 1,
  };
}
