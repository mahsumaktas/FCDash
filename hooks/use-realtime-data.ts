"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useGatewaySSEStore } from "@/stores/gateway-sse";
import { api } from "@/lib/api-client";

interface RealtimeDataOptions<T> {
  /** RPC method to call for polling */
  rpcMethod: string;
  /** RPC params */
  rpcParams?: unknown;
  /** Poll interval in ms (default: 15000) */
  pollInterval?: number;
  /** Gateway events that trigger an immediate refresh */
  refreshEvents?: string[];
  /** Transform RPC result */
  transform?: (result: unknown) => T;
  /** Whether polling is enabled */
  enabled?: boolean;
}

export function useRealtimeData<T>(options: RealtimeDataOptions<T>) {
  const {
    rpcMethod,
    rpcParams,
    pollInterval = 15_000,
    refreshEvents = [],
    transform,
    enabled = true,
  } = options;

  const subscribe = useGatewaySSEStore((s) => s.subscribe);
  const isConnected = useGatewaySSEStore((s) => s.gatewayConnected);

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [flashKey, setFlashKey] = useState(0);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async (flash = false) => {
    if (!isConnected || !enabled) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rpcAny = api.rpc.bind(api) as (...args: any[]) => Promise<unknown>;
      const result = rpcParams
        ? await rpcAny(rpcMethod, rpcParams)
        : await rpcAny(rpcMethod);
      if (!mountedRef.current) return;
      const transformed = transform ? transform(result) : result as T;
      setData(transformed);
      setLastUpdated(Date.now());
      setLoading(false);
      if (flash) setFlashKey((k) => k + 1);
    } catch {
      if (!mountedRef.current) return;
      setLoading(false);
    }
  }, [isConnected, enabled, rpcMethod, rpcParams, transform]);

  // Initial fetch + polling
  useEffect(() => {
    mountedRef.current = true;
    if (!isConnected || !enabled) return;

    fetchData();
    pollRef.current = setInterval(() => fetchData(), pollInterval);

    return () => {
      mountedRef.current = false;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [isConnected, enabled, pollInterval, fetchData]);

  // Event-driven refresh
  useEffect(() => {
    if (!isConnected || refreshEvents.length === 0) return;

    const unsubs: (() => void)[] = [];
    for (const event of refreshEvents) {
      const unsub = subscribe(event, () => {
        // Small delay to let the server process the event
        setTimeout(() => fetchData(true), 500);
      });
      unsubs.push(unsub);
    }

    return () => unsubs.forEach((u) => u());
  }, [isConnected, subscribe, refreshEvents, fetchData]);

  const refetch = useCallback(() => fetchData(true), [fetchData]);

  return { data, loading, lastUpdated, flashKey, refetch };
}

/** Format "last updated" timestamp */
export function formatLastUpdated(ts: number | null): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  if (diff < 5_000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  return `${Math.floor(diff / 60_000)}m ago`;
}
