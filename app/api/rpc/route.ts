// Generic RPC proxy — all gateway methods via POST /api/rpc
// Body: { method: "sessions.list", params: { limit: 50 } }
// Response: { ok: true, data: [...] }

import { NextRequest, NextResponse } from "next/server";
import { getGateway } from "@/lib/server/gateway-singleton";
import { validateRequest, getClientIP } from "@/lib/server/auth";
import { log, startTimer } from "@/lib/server/logger";
import { checkRateLimit, rateLimitHeaders } from "@/lib/server/rate-limit";
import type { RPCMethodMap } from "@/lib/types";

// Allowlist: only methods defined in RPCMethodMap are accepted
const ALLOWED_METHODS = new Set<string>([
  "health", "status", "usage.status", "usage.cost", "sessions.usage",
  "chat.send", "chat.history", "chat.abort",
  "agents.list", "agents.create", "agents.update", "agents.delete",
  "agent",
  "agents.files.list", "agents.files.get", "agents.files.set",
  "sessions.list", "sessions.preview", "sessions.patch",
  "sessions.reset", "sessions.delete", "sessions.compact", "sessions.resolve",
  "models.list",
  "tts.status", "tts.providers", "tts.enable", "tts.disable", "tts.setProvider", "tts.convert",
  "node.list", "node.describe", "node.rename", "node.invoke",
  "node.pair.request", "node.pair.list", "node.pair.approve", "node.pair.reject",
  "device.pair.list", "device.pair.approve", "device.pair.reject", "device.pair.remove",
  "device.token.rotate", "device.token.revoke",
  "skills.status", "skills.bins", "skills.install", "skills.update",
  "channels.status", "channels.logout",
  "web.login.start", "web.login.wait",
  "cron.list", "cron.status", "cron.add", "cron.update", "cron.remove", "cron.run", "cron.runs",
  "config.get", "config.set", "config.schema", "config.apply", "config.patch",
  "exec.approval.resolve", "exec.approvals.get", "exec.approvals.set",
  "logs.tail",
  "talk.config", "talk.mode",
  "voicewake.get", "voicewake.set",
  "update.run",
] satisfies (keyof RPCMethodMap)[]);

const LOCAL_IPS = ["unknown", "127.0.0.1", "::1", "localhost"];

function isLocalIP(ip: string): boolean {
  return LOCAL_IPS.includes(ip) || ip.startsWith("::ffff:127.");
}

export async function POST(request: NextRequest) {
  const elapsed = startTimer();
  const ip = getClientIP(request);

  // Rate limiting — only for remote access (Tailscale, etc.)
  // Localhost is single-user, rate limiting gereksiz
  if (!isLocalIP(ip)) {
    const rl = checkRateLimit(ip, 100, 60_000);
    if (!rl.allowed) {
      log("warn", "rpc.rate_limited", { ip });
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "rate_limited",
            message: "Too many requests",
            retryable: true,
            retryAfterMs: rl.resetAt - Date.now(),
          },
        },
        { status: 429, headers: rateLimitHeaders(rl) },
      );
    }
  }

  // Auth check
  const auth = validateRequest(request);
  if (!auth.ok) {
    log("warn", "rpc.unauthorized", { ip, reason: auth.reason });
    return NextResponse.json(
      { ok: false, error: { code: "unauthorized", message: "Unauthorized" } },
      { status: 401 },
    );
  }

  // Parse body
  let body: { method?: string; params?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "bad_request", message: "Invalid JSON body" } },
      { status: 400 },
    );
  }

  const { method, params } = body;

  // Validate method
  if (!method || typeof method !== "string") {
    return NextResponse.json(
      { ok: false, error: { code: "bad_request", message: "Missing 'method' field" } },
      { status: 400 },
    );
  }

  if (!ALLOWED_METHODS.has(method)) {
    log("warn", "rpc.blocked", { method, ip });
    return NextResponse.json(
      { ok: false, error: { code: "method_not_allowed", message: `Unknown method: ${method}` } },
      { status: 400 },
    );
  }

  // Check gateway connection
  const { client } = getGateway();
  if (!client.isConnected) {
    log("warn", "rpc.gateway_unavailable", { method, ip });
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "gateway_unavailable",
          message: "Gateway is not connected",
          retryable: true,
          retryAfterMs: 2000,
        },
      },
      { status: 503 },
    );
  }

  // Execute RPC
  try {
    const result = params !== undefined
      ? await client.request(method, params)
      : await client.request(method);

    const durationMs = elapsed();
    log("info", `rpc.${method}`, { durationMs, ip });

    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    const durationMs = elapsed();
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout = message.includes("timeout");
    log("error", `rpc.${method}`, { durationMs, ip, error: message });

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "rpc_error",
          message,
          retryable: isTimeout,
          ...(isTimeout && { retryAfterMs: 1000 }),
        },
      },
      { status: 502 },
    );
  }
}
