// OpenClaw Gateway WebSocket Client
// Ported from openclaw/ui/src/ui/gateway.ts to plain TypeScript (no Lit dependency)

import type {
  EventFrame,
  ResponseFrame,
  HelloOk,
  GatewayConnectionState,
  GatewayEventName,
  GatewayEventMap,
  RPCMethodMap,
  RPCParams,
  RPCResult,
} from "@/lib/types";

// crypto.randomUUID fallback for non-secure contexts (e.g. http://localhost)
function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

type Pending = {
  resolve: (value: unknown) => void;
  reject: (err: unknown) => void;
  timer?: ReturnType<typeof setTimeout>;
};

type EventListener<E extends GatewayEventName = GatewayEventName> = (
  payload: GatewayEventMap[E]
) => void;

/** Ed25519 device identity for secure control-ui auth */
export type DeviceIdentity = {
  deviceId: string;
  publicKeyPem: string;
  privateKeyPem: string;
};

export type GatewayClientOptions = {
  url: string;
  token?: string;
  password?: string;
  clientName?: string;
  clientVersion?: string;
  instanceId?: string;
  /** Device identity for signed auth (Node.js only) */
  device?: DeviceIdentity;
  autoConnect?: boolean;
  rpcTimeoutMs?: number;
  /** Extra headers for server-side WebSocket (Node.js only, ignored in browser) */
  wsHeaders?: Record<string, string>;
  onStateChange?: (state: GatewayConnectionState) => void;
  onHello?: (hello: HelloOk) => void;
  onEvent?: (evt: EventFrame) => void;
  onError?: (error: Error) => void;
};

const CONNECT_FAILED_CODE = 4008;

// ─── Device Auth Helpers (Node.js only) ─────────────────────────────────────

function buildCanonicalString(opts: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token: string;
  nonce?: string;
}): string {
  const version = opts.nonce ? "v2" : "v1";
  const parts = [
    version,
    opts.deviceId,
    opts.clientId,
    opts.clientMode,
    opts.role,
    opts.scopes.join(","),
    String(opts.signedAtMs),
    opts.token,
  ];
  if (version === "v2") parts.push(opts.nonce ?? "");
  return parts.join("|");
}

async function signDevice(
  device: DeviceIdentity,
  clientId: string,
  clientMode: string,
  role: string,
  scopes: string[],
  token: string,
  nonce?: string,
): Promise<{ id: string; publicKey: string; signature: string; signedAt: number; nonce?: string }> {
  const { sign, createPublicKey } = await import("node:crypto");

  const signedAt = Date.now();
  const canonical = buildCanonicalString({
    deviceId: device.deviceId,
    clientId,
    clientMode,
    role,
    scopes,
    signedAtMs: signedAt,
    token,
    nonce,
  });

  const sig = sign(null, Buffer.from(canonical), device.privateKeyPem);
  const signature = sig.toString("base64");

  // Extract raw 32-byte Ed25519 public key from SPKI PEM
  const pubKey = createPublicKey(device.publicKeyPem);
  const der = pubKey.export({ type: "spki", format: "der" });
  const rawPubKey = der.subarray(12).toString("base64");

  return {
    id: device.deviceId,
    publicKey: rawPubKey,
    signature,
    signedAt,
    ...(nonce ? { nonce } : {}),
  };
}

// ─── Client ─────────────────────────────────────────────────────────────────

export class GatewayClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  private listeners = new Map<string, Set<EventListener>>();
  private closed = false;
  private lastSeq: number | null = null;
  private connectNonce: string | null = null;
  private connectSent = false;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = 2_000;
  private authFailCount = 0;
  private opts: Required<
    Pick<GatewayClientOptions, "url" | "rpcTimeoutMs">
  > &
    GatewayClientOptions;

  state: GatewayConnectionState = "disconnected";
  hello: HelloOk | null = null;
  error: Error | null = null;

  constructor(options: GatewayClientOptions) {
    this.opts = {
      rpcTimeoutMs: 30_000,
      ...options,
    };
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  connect() {
    this.closed = false;
    this.error = null;
    this.setState("connecting");
    this.doConnect();
  }

  disconnect() {
    this.closed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.flushPending(new Error("gateway client stopped"));
    this.setState("disconnected");
  }

  get isConnected() {
    return this.state === "connected";
  }

  // ─── RPC ────────────────────────────────────────────────────────────────

  async rpc<M extends keyof RPCMethodMap>(
    method: M,
    ...args: RPCParams<M> extends void ? [] : [RPCParams<M>]
  ): Promise<RPCResult<M>> {
    const params = args[0];
    return this.request(method, params) as Promise<RPCResult<M>>;
  }

  request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("gateway not connected"));
    }
    const id = generateId();
    const frame = { type: "req", id, method, params };

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`RPC timeout: ${method} (${this.opts.rpcTimeoutMs}ms)`));
      }, this.opts.rpcTimeoutMs);

      this.pending.set(id, {
        resolve: (v) => resolve(v as T),
        reject,
        timer,
      });
      this.ws!.send(JSON.stringify(frame));
    });
  }

  // ─── Event Subscription ─────────────────────────────────────────────────

  on<E extends GatewayEventName>(
    event: E,
    callback: (payload: GatewayEventMap[E]) => void
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    set.add(callback as EventListener);

    return () => {
      set.delete(callback as EventListener);
      if (set.size === 0) this.listeners.delete(event);
    };
  }

  // ─── Internal ───────────────────────────────────────────────────────────

  private setState(s: GatewayConnectionState) {
    if (this.state === s) return;
    this.state = s;
    this.opts.onStateChange?.(s);
  }

  private doConnect() {
    if (this.closed) return;

    try {
      // Node.js native WebSocket accepts an options object with headers;
      // browser WebSocket ignores the second arg when it's not protocols.
      const headers = this.opts.wsHeaders;
      this.ws = headers && typeof window === "undefined"
        ? new WebSocket(this.opts.url, { headers } as unknown as string[])
        : new WebSocket(this.opts.url);
    } catch (err) {
      this.error = err instanceof Error ? err : new Error(String(err));
      this.setState("error");
      this.scheduleReconnect();
      return;
    }

    this.ws.addEventListener("open", () => {
      this.setState("authenticating");
      this.queueConnect();
    });

    this.ws.addEventListener("message", (ev) => {
      this.handleMessage(String(ev.data ?? ""));
    });

    this.ws.addEventListener("close", (ev) => {
      this.ws = null;
      this.flushPending(
        new Error(`gateway closed (${ev.code}): ${ev.reason ?? ""}`)
      );
      if (!this.closed) {
        this.setState("disconnected");
        this.scheduleReconnect();
      }
    });

    this.ws.addEventListener("error", () => {
      // Close handler will fire
    });
  }

  private scheduleReconnect() {
    if (this.closed) return;
    // Auth failures get longer backoff to stay under gateway's 10 attempt/60s limit
    const delay = this.authFailCount >= 3
      ? Math.min(30_000, 10_000 * this.authFailCount)
      : this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 2, 30_000);
    this.reconnectTimer = setTimeout(() => {
      this.setState("connecting");
      this.doConnect();
    }, delay);
  }

  private flushPending(err: Error) {
    for (const [, p] of this.pending) {
      if (p.timer) clearTimeout(p.timer);
      p.reject(err);
    }
    this.pending.clear();
  }

  private queueConnect() {
    this.connectNonce = null;
    this.connectSent = false;
    if (this.connectTimer) clearTimeout(this.connectTimer);
    // Wait briefly for challenge nonce, then send connect anyway
    this.connectTimer = setTimeout(() => {
      this.sendConnect();
    }, 750);
  }

  private async sendConnect() {
    if (this.connectSent) return;
    this.connectSent = true;
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }

    const clientId = this.opts.clientName ?? "openclaw-control-ui";
    const clientMode = "webchat";
    const role = "operator";
    const scopes = ["operator.admin", "operator.approvals", "operator.pairing"];
    const tokenValue = this.opts.token ?? "";

    const auth =
      this.opts.token || this.opts.password
        ? { token: this.opts.token, password: this.opts.password }
        : undefined;

    // Build device identity with Ed25519 signature (Node.js server-side only)
    let deviceField: { id: string; publicKey: string; signature: string; signedAt: number; nonce?: string } | undefined;
    if (this.opts.device) {
      try {
        deviceField = await signDevice(
          this.opts.device,
          clientId,
          clientMode,
          role,
          scopes,
          tokenValue,
          this.connectNonce ?? undefined,
        );
      } catch (err) {
        console.error("[gateway] device signing failed:", err);
      }
    }

    const params = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: clientId,
        version: this.opts.clientVersion ?? "1.0.0",
        platform: typeof navigator !== "undefined" ? navigator.platform : "node",
        mode: clientMode,
        instanceId: this.opts.instanceId,
      },
      role,
      scopes,
      device: deviceField,
      caps: [],
      auth,
      locale: typeof navigator !== "undefined" ? navigator.language : "en",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "node",
    };

    this.request<HelloOk>("connect", params)
      .then((hello) => {
        this.hello = hello;
        this.backoffMs = 2_000;
        this.authFailCount = 0;
        this.setState("connected");
        this.opts.onHello?.(hello);
      })
      .catch((err) => {
        this.authFailCount++;
        this.error = err instanceof Error ? err : new Error(String(err));
        this.setState("error");
        this.opts.onError?.(this.error);
        this.ws?.close(CONNECT_FAILED_CODE, "connect failed");
      });
  }

  private handleMessage(raw: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    const frame = parsed as { type?: string };

    if (frame.type === "event") {
      const evt = parsed as EventFrame;

      // Handle connect challenge
      if (evt.event === "connect.challenge") {
        const payload = evt.payload as { nonce?: string } | undefined;
        if (payload?.nonce) {
          this.connectNonce = payload.nonce;
          this.sendConnect();
        }
        return;
      }

      // Sequence gap detection
      const seq = typeof evt.seq === "number" ? evt.seq : null;
      if (seq !== null && this.lastSeq !== null && seq > this.lastSeq + 1) {
        console.warn(
          `[openclaw] event sequence gap: expected ${this.lastSeq + 1}, got ${seq}`
        );
      }
      if (seq !== null) this.lastSeq = seq;

      // Notify global handler
      this.opts.onEvent?.(evt);

      // Notify typed listeners
      const listeners = this.listeners.get(evt.event);
      if (listeners) {
        for (const cb of listeners) {
          try {
            (cb as (payload: unknown) => void)(evt.payload);
          } catch (err) {
            console.error("[openclaw] event listener error:", err);
          }
        }
      }
      return;
    }

    if (frame.type === "res") {
      const res = parsed as ResponseFrame;
      const pending = this.pending.get(res.id);
      if (!pending) return;
      this.pending.delete(res.id);
      if (pending.timer) clearTimeout(pending.timer);
      if (res.ok) {
        pending.resolve(res.payload);
      } else {
        pending.reject(
          new Error(res.error?.message ?? "request failed")
        );
      }
    }
  }
}
