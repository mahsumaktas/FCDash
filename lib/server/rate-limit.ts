// In-memory sliding window rate limiter
// No external dependencies — suitable for single-server deployments

type Entry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, Entry>();

// Periodic cleanup to prevent memory leaks
const CLEANUP_INTERVAL_MS = 60_000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key);
    }
  }, CLEANUP_INTERVAL_MS);
  // Don't prevent process from exiting
  if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

/**
 * Check rate limit for a given key (typically IP address).
 *
 * @param key - Unique identifier (e.g., IP address)
 * @param limit - Max requests per window (default: 100)
 * @param windowMs - Window size in milliseconds (default: 60_000)
 */
export function checkRateLimit(
  key: string,
  limit = 100,
  windowMs = 60_000,
): RateLimitResult {
  ensureCleanup();
  const now = Date.now();
  const entry = store.get(key);

  // New window or expired
  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, limit, remaining: limit - 1, resetAt };
  }

  // Within window
  entry.count++;
  const remaining = Math.max(0, limit - entry.count);
  return {
    allowed: entry.count <= limit,
    limit,
    remaining,
    resetAt: entry.resetAt,
  };
}

/** Rate limit response headers */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}
