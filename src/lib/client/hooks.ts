"use client";
// Small data hooks over ./api. Each refetches on mount, on invalidate(), and
// optionally on an interval (poll-ready for live activity / credits).
import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "./api";

export interface Resource<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

export function useResource<T>(loader: () => Promise<T>, opts: { pollMs?: number; deps?: unknown[] } = {}): Resource<T> {
  const { pollMs, deps = [] } = opts;
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loaderRef = useRef(loader);
  // Keep the latest loader without re-subscribing; runs before the fetch effect below.
  useEffect(() => {
    loaderRef.current = loader;
  });

  const reload = useCallback(() => {
    loaderRef
      .current()
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
    const off = api.subscribe(reload);
    const t = pollMs ? setInterval(reload, pollMs) : undefined;
    return () => {
      off();
      if (t) clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, pollMs, ...deps]);

  return { data, error, loading, reload };
}

export const useProduct = () => useResource(api.getProduct);
export const useIcp = (productId: number | undefined) =>
  useResource(() => (productId ? api.getIcp(productId) : Promise.resolve(null)), { deps: [productId] });
export const useActivity = (pollMs = 2000) => useResource(() => api.listActivity(50), { pollMs });
export const useCredits = (pollMs = 5000) => useResource(api.getCredits, { pollMs });
export const useLeads = () => useResource(api.listLeads);
export const useOutbox = () => useResource(api.listOutbox);
export const useAnalytics = (productId?: number) => useResource(() => api.getAnalytics(productId), { pollMs: 10000, deps: [productId] });
