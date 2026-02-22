import { create } from "zustand";

type EventCallback = (payload: unknown) => void;

interface GatewaySSEStore {
  /** SSE connection state (browser → Next.js server) */
  connectionState: "disconnected" | "connecting" | "connected" | "error";
  /** Server-side gateway connection state (from gateway.state events) */
  gatewayConnected: boolean;
  gatewayState: string;
  /** Event bus — same subscribe/emit pattern as the old gateway store */
  subscribe: (event: string, cb: EventCallback) => () => void;
  emit: (event: string, payload: unknown) => void;
  /** Internal setters used by the provider */
  _setConnectionState: (state: GatewaySSEStore["connectionState"]) => void;
  _setGatewayState: (state: string, connected: boolean) => void;
}

// Event bus lives outside Zustand to avoid re-renders on listener changes
const listeners = new Map<string, Set<EventCallback>>();

function subscribe(event: string, cb: EventCallback): () => void {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  const set = listeners.get(event)!;
  set.add(cb);
  return () => {
    set.delete(cb);
    if (set.size === 0) listeners.delete(event);
  };
}

function emit(event: string, payload: unknown): void {
  const set = listeners.get(event);
  if (!set) return;
  for (const cb of set) {
    try {
      cb(payload);
    } catch (err) {
      console.error("[gateway-sse] listener error:", err);
    }
  }
}

export const useGatewaySSEStore = create<GatewaySSEStore>((set) => ({
  connectionState: "disconnected",
  gatewayConnected: false,
  gatewayState: "disconnected",
  subscribe,
  emit,
  _setConnectionState: (connectionState) => set({ connectionState }),
  _setGatewayState: (gatewayState, gatewayConnected) =>
    set({ gatewayState, gatewayConnected }),
}));
