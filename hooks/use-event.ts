"use client";
import { useEffect, useRef } from "react";
import { useGatewaySSEStore } from "@/stores/gateway-sse";
import type { GatewayEventName, GatewayEventMap } from "@/lib/types";

export function useEvent<E extends GatewayEventName>(
  event: E,
  callback: (payload: GatewayEventMap[E]) => void,
  enabled = true
) {
  const subscribe = useGatewaySSEStore((s) => s.subscribe);
  const isConnected = useGatewaySSEStore((s) => s.gatewayConnected);
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (!isConnected || !enabled) return;
    return subscribe(event, (payload) => cbRef.current(payload as GatewayEventMap[E]));
  }, [isConnected, enabled, event, subscribe]);
}
