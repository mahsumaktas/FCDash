"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { api } from "@/lib/api-client";
import type { RPCMethodMap, RPCParams, RPCResult } from "@/lib/types";

// ─── useApiQuery ─────────────────────────────────────────────────────────────

interface ApiQueryOptions<M extends keyof RPCMethodMap> {
  /** RPC method to call */
  method: M;
  /** RPC params (omit for void-param methods) */
  params?: RPCParams<M>;
  /** Poll interval in ms (default: 0 = disabled, set explicitly where needed) */
  pollInterval?: number;
  /** Whether the query is enabled */
  enabled?: boolean;
}

export function useApiQuery<M extends keyof RPCMethodMap>(
  options: ApiQueryOptions<M>,
) {
  const {
    method,
    params,
    pollInterval = 0,
    enabled = true,
  } = options;

  const [data, setData] = useState<RPCResult<M> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [flashKey, setFlashKey] = useState(0);

  const mountedRef = useRef(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Stable serialized params for dependency tracking
  const paramsKey = JSON.stringify(params ?? null);

  const fetchData = useCallback(async (flash = false) => {
    if (!enabled) return;

    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = params !== undefined
        ? await (api.rpc as any)(method, params, controller.signal)
        : await (api.rpc as any)(method, undefined, controller.signal);
      if (!mountedRef.current || controller.signal.aborted) return;
      setData(result);
      setError(null);
      setLastUpdated(Date.now());
      setLoading(false);
      if (flash) setFlashKey((k) => k + 1);
    } catch (err) {
      if (!mountedRef.current || controller.signal.aborted) return;
      // Don't treat abort as error
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err : new Error(String(err)));
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, method, paramsKey]);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) return;

    fetchData();

    if (pollInterval > 0) {
      pollRef.current = setInterval(() => fetchData(), pollInterval);
    }

    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      abortRef.current = null;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [enabled, pollInterval, fetchData]);

  const refetch = useCallback(() => fetchData(true), [fetchData]);

  return { data, loading, error, lastUpdated, flashKey, refetch };
}

// ─── useApiMutation ──────────────────────────────────────────────────────────

export function useApiMutation<M extends keyof RPCMethodMap>(method: M) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const mutate = useCallback(
    async (...args: RPCParams<M> extends void ? [] : [RPCParams<M>]): Promise<RPCResult<M>> => {
      setLoading(true);
      setError(null);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = args.length > 0
          ? await (api.rpc as any)(method, args[0])
          : await (api.rpc as any)(method);
        if (mountedRef.current) setLoading(false);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        if (mountedRef.current) {
          setError(error);
          setLoading(false);
        }
        throw error;
      }
    },
    [method],
  );

  return { mutate, loading, error };
}
