// Server-side gateway singleton — HMR-safe via globalThis
// Only runs in Node.js (API routes / server components)
//
// Auto-recycle: when this file changes during HMR, the version tag
// bumps and the stale singleton is torn down + rebuilt automatically.
// Config changes (.env) are also detected and trigger a recycle.

import { GatewayClient, type GatewayClientOptions, type DeviceIdentity } from "@/lib/gateway-client";
import type { EventFrame, GatewayEventName, GatewayEventMap } from "@/lib/types";
import { log } from "./logger";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// Bump this when changing init logic. HMR will pick up the new value;
// the running singleton won't match → auto-recycle. No restart needed.
const SINGLETON_VERSION = 7;

type EventListener = (payload: unknown) => void;

class GatewayEventBus {
  private listeners = new Map<string, Set<EventListener>>();

  on<E extends GatewayEventName>(
    event: E,
    callback: (payload: GatewayEventMap[E]) => void,
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    const cb = callback as EventListener;
    set.add(cb);
    return () => {
      set.delete(cb);
      if (set.size === 0) this.listeners.delete(event);
    };
  }

  emit(event: string, payload: unknown) {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const cb of set) {
      try {
        cb(payload);
      } catch (err) {
        console.error("[gateway-bus] listener error:", err);
      }
    }
  }

  get listenerCount(): number {
    let count = 0;
    for (const set of this.listeners.values()) count += set.size;
    return count;
  }
}

export type ServerGateway = {
  client: GatewayClient;
  bus: GatewayEventBus;
  /** Code version — mismatch triggers auto-recycle */
  version: number;
  /** Config fingerprint — env change triggers auto-recycle */
  configKey: string;
};

const g = globalThis as typeof globalThis & { __serverGateway?: ServerGateway };

function resolveConfig() {
  const url = process.env.OPENCLAW_GATEWAY_URL ?? "wss://localhost:28643";

  // Prefer live device token from device-auth.json (survives gateway restarts)
  // Fall back to env vars for manual override
  const liveToken = loadDeviceToken();
  const token = liveToken
    ?? process.env.OPENCLAW_DEVICE_TOKEN
    ?? process.env.OPENCLAW_GATEWAY_TOKEN;

  return { url, token };
}

/** Read the current device operator token from device-auth.json */
function loadDeviceToken(): string | undefined {
  try {
    const authPath = join(homedir(), ".openclaw", "identity", "device-auth.json");
    const raw = readFileSync(authPath, "utf-8");
    const data = JSON.parse(raw);
    return data?.tokens?.operator?.token;
  } catch {
    return undefined;
  }
}

function loadDeviceIdentity(): DeviceIdentity | undefined {
  try {
    const devicePath = join(homedir(), ".openclaw", "identity", "device.json");
    const raw = readFileSync(devicePath, "utf-8");
    const data = JSON.parse(raw);
    if (data?.deviceId && data?.publicKeyPem && data?.privateKeyPem) {
      return {
        deviceId: data.deviceId,
        publicKeyPem: data.publicKeyPem,
        privateKeyPem: data.privateKeyPem,
      };
    }
  } catch {
    log("warn", "gateway.device-identity", { error: "failed to load device identity" });
  }
  return undefined;
}

function configKey(url: string, token?: string): string {
  return `${url}|${token ?? ""}`;
}

export function getGateway(): ServerGateway {
  const existing = g.__serverGateway;
  const { url, token } = resolveConfig();
  const key = configKey(url, token);

  // Return existing if version and config both match
  if (existing && existing.version === SINGLETON_VERSION && existing.configKey === key) {
    return existing;
  }

  // Stale singleton — tear down gracefully before rebuilding
  if (existing) {
    const reason = existing.version !== SINGLETON_VERSION ? "version" : "config";
    log("info", "gateway.recycle", {
      reason,
      oldVersion: existing.version,
      newVersion: SINGLETON_VERSION,
    });
    try { existing.client.disconnect(); } catch { /* best effort */ }
    g.__serverGateway = undefined;
  }

  // Allow self-signed TLS certs for localhost gateway
  if (url.includes("localhost") || url.includes("127.0.0.1")) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }

  const device = loadDeviceIdentity();

  const bus = new GatewayEventBus();

  const opts: GatewayClientOptions = {
    url,
    token,
    device,
    clientName: "openclaw-control-ui",
    clientVersion: "1.0.0",
    autoConnect: false,
    wsHeaders: { Origin: "https://localhost:3000" },
    onStateChange: (state) => {
      log("info", "gateway.state", { state });
      bus.emit("gateway.state", { state, connected: state === "connected" });
    },
    onHello: (hello) => {
      log("info", "gateway.connected", {
        version: hello.server.version,
        connId: hello.server.connId,
        methods: hello.features.methods.length,
        events: hello.features.events.length,
      });
    },
    onEvent: (evt: EventFrame) => {
      bus.emit(evt.event, evt.payload);
    },
    onError: (error) => {
      log("error", "gateway.error", { error: error.message });
    },
  };

  const client = new GatewayClient(opts);
  client.connect();

  const gw: ServerGateway = { client, bus, version: SINGLETON_VERSION, configKey: key };
  g.__serverGateway = gw;
  return gw;
}

/** Check if gateway is connected without triggering initialization */
export function isGatewayConnected(): boolean {
  return g.__serverGateway?.client.isConnected ?? false;
}
