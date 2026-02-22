#!/usr/bin/env bash
set -euo pipefail

DASHBOARD_DIR="$(cd "$(dirname "$0")/.." && pwd)"
GATEWAY_PORT="${OPENCLAW_GATEWAY_PORT:-28643}"
GATEWAY_URL="https://localhost:${GATEWAY_PORT}"
DASHBOARD_PORT=3001
MAX_WAIT=120  # saniye — gateway'in ayaga kalkmasi icin max bekleme

cd "$DASHBOARD_DIR"

# --- Graceful shutdown ---
cleanup() {
  echo "[fcdash] Shutting down (PID: $$)..."
  if [[ -n "${NEXT_PID:-}" ]]; then
    kill "$NEXT_PID" 2>/dev/null || true
    wait "$NEXT_PID" 2>/dev/null || true
  fi
  exit 0
}
trap cleanup SIGTERM SIGINT SIGHUP

# --- Gateway health check ---
echo "[fcdash] Waiting for gateway at ${GATEWAY_URL}..."
elapsed=0
while ! curl -sk --max-time 2 "${GATEWAY_URL}/health" >/dev/null 2>&1; do
  if (( elapsed >= MAX_WAIT )); then
    echo "[fcdash] ERROR: Gateway not reachable after ${MAX_WAIT}s, starting anyway..."
    break
  fi
  sleep 2
  elapsed=$((elapsed + 2))
done

if (( elapsed < MAX_WAIT )); then
  echo "[fcdash] Gateway is up (waited ${elapsed}s)."
fi

# --- Build if needed ---
# Rebuild if .next doesn't exist or package.json is newer than .next
if [[ ! -d "$DASHBOARD_DIR/.next" ]] || [[ "$DASHBOARD_DIR/package.json" -nt "$DASHBOARD_DIR/.next/BUILD_ID" ]]; then
  echo "[fcdash] Building production bundle..."
  npx next build
  echo "[fcdash] Build complete."
else
  echo "[fcdash] Using existing build."
fi

# --- Start Next.js ---
echo "[fcdash] Starting on port ${DASHBOARD_PORT}..."
npx next start -p "$DASHBOARD_PORT" &
NEXT_PID=$!
wait "$NEXT_PID"
