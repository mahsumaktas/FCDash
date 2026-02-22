// Server-side auth validation for API routes
// Mirrors the logic in middleware.ts but returns a result instead of redirecting

import { type NextRequest } from "next/server";

const AUTH_COOKIE = "fcdash-token";
const TAILSCALE_HEADER = "Tailscale-User-Login";

export type AuthResult =
  | { ok: true; identity: string }
  | { ok: false; reason: string };

/** Validate an API request. Returns identity string on success. */
export function validateRequest(request: NextRequest): AuthResult {
  const host = request.headers.get("host") ?? "";

  // Localhost bypass
  if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) {
    return { ok: true, identity: "localhost" };
  }

  // Tailscale identity
  const tailscaleUser = request.headers.get(TAILSCALE_HEADER);
  if (tailscaleUser) {
    return { ok: true, identity: `tailscale:${tailscaleUser}` };
  }

  // Cookie auth
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (token) {
    return { ok: true, identity: `cookie:${token.slice(0, 8)}...` };
  }

  return { ok: false, reason: "unauthorized" };
}

/** Extract client IP from request headers */
export function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown"
  );
}
