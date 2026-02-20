"use client";
import { useEffect, useRef } from "react";
import { useGatewayStore } from "@/stores/gateway";
import type { GatewayEventName, GatewayEventMap } from "@/lib/types";

export function useEvent<E extends GatewayEventName>(
  event: E,
  callback: (payload: GatewayEventMap[E]) => void,
  enabled = true
) {
  const subscribe = useGatewayStore((s) => s.subscribe);
  const isConnected = useGatewayStore((s) => s.state === "connected");
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (!isConnected || !enabled) return;
    return subscribe(event, (payload) => cbRef.current(payload));
  }, [isConnected, enabled, event, subscribe]);
}
