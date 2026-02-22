// Frontend API client — fetch-based replacement for direct WebSocket calls
// Uses RPCMethodMap for full type safety

import type {
  RPCMethodMap,
  RPCParams,
  RPCResult,
  GatewayError,
} from "@/lib/types";

type RPCResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: GatewayError };

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1_000;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason); return; }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
  });
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl = "") {
    this.baseUrl = baseUrl;
  }

  /** Type-safe RPC call via /api/rpc — auto-retries on 429/503 */
  async rpc<M extends keyof RPCMethodMap>(
    method: M,
    params?: RPCParams<M>,
    signal?: AbortSignal,
  ): Promise<RPCResult<M>> {
    let lastError: ApiError | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

      const res = await fetch(`${this.baseUrl}/api/rpc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, params }),
        signal,
      });

      const json = (await res.json()) as RPCResponse<RPCResult<M>>;

      if (json.ok) return json.data;

      lastError = new ApiError(
        json.error.message,
        json.error.code,
        res.status,
        json.error,
      );

      // Retry only on 503 (gateway unavailable) — retrying 429 makes rate limiting worse
      const retryable = res.status === 503;
      if (!retryable || attempt === MAX_RETRIES) throw lastError;

      // Respect Retry-After header or use exponential backoff
      const retryAfter = res.headers.get("Retry-After");
      const retryMs = json.error.retryAfterMs
        ?? (retryAfter ? parseInt(retryAfter, 10) * 1000 : null)
        ?? INITIAL_BACKOFF_MS * 2 ** attempt;

      await sleep(retryMs, signal);
    }

    throw lastError!;
  }

  /** Fetch health status */
  async health(): Promise<{
    gateway: string;
    state: string;
    uptime: number | null;
    version: string | null;
  }> {
    const res = await fetch(`${this.baseUrl}/api/health`);
    return res.json();
  }

}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: GatewayError;

  constructor(message: string, code: string, status: number, details?: GatewayError) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/** Singleton API client instance */
export const api = new ApiClient();
