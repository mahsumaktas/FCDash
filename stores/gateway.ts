import { create } from "zustand";
import { GatewayClient, type GatewayClientOptions } from "@/lib/gateway-client";
import type {
  GatewayConnectionState, HelloOk, Snapshot,
  GatewayEventName, GatewayEventMap,
  RPCMethodMap, RPCParams, RPCResult,
} from "@/lib/types";

interface GatewayStore {
  client: GatewayClient | null;
  state: GatewayConnectionState;
  hello: HelloOk | null;
  snapshot: Snapshot | null;
  error: Error | null;
  init: (opts: GatewayClientOptions) => void;
  connect: () => void;
  disconnect: () => void;
  rpc: <M extends keyof RPCMethodMap>(method: M, ...args: RPCParams<M> extends void ? [] : [RPCParams<M>]) => Promise<RPCResult<M>>;
  subscribe: <E extends GatewayEventName>(event: E, cb: (payload: GatewayEventMap[E]) => void) => () => void;
}

export const useGatewayStore = create<GatewayStore>((set, get) => ({
  client: null,
  state: "disconnected",
  hello: null,
  snapshot: null,
  error: null,

  init: (opts) => {
    const existing = get().client;
    if (existing) existing.disconnect();
    const client = new GatewayClient({
      ...opts,
      onStateChange: (s) => set({ state: s }),
      onHello: (hello) => set({ hello, snapshot: hello.snapshot }),
      onError: (error) => set({ error }),
    });
    set({ client });
  },

  connect: () => get().client?.connect(),
  disconnect: () => get().client?.disconnect(),

  rpc: async (method, ...args) => {
    const client = get().client;
    if (!client) throw new Error("Gateway not initialized");
    return client.rpc(method, ...args);
  },

  subscribe: (event, cb) => {
    const client = get().client;
    if (!client) return () => {};
    return client.on(event, cb);
  },
}));
