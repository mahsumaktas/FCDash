// Shared auth constants and client-side helpers
// Server-only functions (cookies) are in middleware.ts directly

export const AUTH_COOKIE = "fcdash-token";
export const TAILSCALE_HEADER = "Tailscale-User-Login";

/** Client-side: set auth cookie */
export function setAuthCookie(token: string) {
  document.cookie = `${AUTH_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=strict`;
}

/** Client-side: clear auth cookie */
export function clearAuthCookie() {
  document.cookie = `${AUTH_COOKIE}=; path=/; max-age=0`;
}

/** Client-side: check if auth cookie exists */
export function hasAuthCookie(): boolean {
  return document.cookie.split(";").some((c) => c.trim().startsWith(`${AUTH_COOKIE}=`));
}
