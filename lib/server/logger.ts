// Structured JSON logger
// Primary: stdout (12-factor app — let infrastructure collect logs)
// Secondary: optional file output for local debugging

import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const LOG_DIR = join(process.cwd(), "logs");
const LOG_FILE = join(LOG_DIR, "api.jsonl");
const FILE_LOGGING = process.env.DISABLE_FILE_LOGGING !== "1";

let dirEnsured = false;

type LogLevel = "info" | "warn" | "error" | "debug";

type LogEntry = {
  ts: string;
  level: LogLevel;
  method: string;
  durationMs?: number;
  error?: string;
  ip?: string;
  [key: string]: unknown;
};

export function log(
  level: LogLevel,
  method: string,
  extra?: Record<string, unknown>,
) {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    method,
    ...extra,
  };

  const json = JSON.stringify(entry);

  // Always write structured JSON to stdout (12-factor app)
  if (process.env.NODE_ENV === "development") {
    // Dev: colored human-readable + structured
    const prefix = level === "error" ? "\x1b[31m" : level === "warn" ? "\x1b[33m" : "\x1b[36m";
    console.log(`${prefix}[api]\x1b[0m ${method}`, extra ?? "");
  } else {
    // Production: structured JSON to stdout
    const out = level === "error" ? console.error : console.log;
    out(json);
  }

  // Optional file output
  if (FILE_LOGGING) {
    try {
      if (!dirEnsured) {
        mkdirSync(LOG_DIR, { recursive: true });
        dirEnsured = true;
      }
      appendFileSync(LOG_FILE, json + "\n");
    } catch {
      // Don't crash the server if file logging fails
    }
  }
}

/** Timer helper for measuring RPC duration */
export function startTimer(): () => number {
  const start = performance.now();
  return () => Math.round(performance.now() - start);
}
