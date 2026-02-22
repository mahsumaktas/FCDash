"use client";

import { useEffect, useRef } from "react";
import { useGatewaySSEStore } from "@/stores/gateway-sse";

/** All named SSE events the unified gateway endpoint can send */
const SSE_EVENTS = [
  "gateway.state",
  "health",
  "presence",
  "tick",
  "heartbeat",
  "shutdown",
  "chat",
  "exec.approval.requested",
  "exec.approval.resolved",
  "device.pair.requested",
  "device.pair.resolved",
  "node.pair.requested",
  "node.pair.resolved",
  "voicewake.changed",
  "talk.mode",
  "cron",
] as const;

const RECONNECT_DELAY_MS = 3_000;

export function GatewaySSEProvider({ children }: { children: React.ReactNode }) {
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setConnectionState = useGatewaySSEStore((s) => s._setConnectionState);
  const setGatewayState = useGatewaySSEStore((s) => s._setGatewayState);
  const emit = useGatewaySSEStore((s) => s.emit);

  useEffect(() => {
    function connect() {
      // Clean up any previous connection
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }

      setConnectionState("connecting");

      const es = new EventSource("/api/events/gateway");
      esRef.current = es;

      es.onopen = () => {
        setConnectionState("connected");
      };

      es.onerror = () => {
        setConnectionState("error");
        es.close();
        esRef.current = null;
        // Auto-reconnect
        reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
      };

      // Register listeners for every named event
      for (const eventName of SSE_EVENTS) {
        es.addEventListener(eventName, (e) => {
          let payload: unknown;
          try {
            payload = JSON.parse((e as MessageEvent).data);
          } catch {
            return;
          }

          // gateway.state is a synthetic event — update the store directly
          if (eventName === "gateway.state") {
            const data = payload as { state?: string; connected?: boolean };
            setGatewayState(
              data.state ?? "disconnected",
              data.connected ?? false,
            );
            return;
          }

          // Forward all other events through the event bus
          emit(eventName, payload);
        });
      }
    }

    connect();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      setConnectionState("disconnected");
    };
  }, [setConnectionState, setGatewayState, emit]);

  return <>{children}</>;
}
