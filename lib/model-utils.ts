// ── Model color coding ──────────────────────────────────────────────────────

type ModelColor = {
  bg: string;
  text: string;
  dot: string;
};

const MODEL_COLORS: Record<string, ModelColor> = {
  opus:     { bg: "bg-violet-500/15", text: "text-violet-400", dot: "bg-violet-400" },
  sonnet:   { bg: "bg-sky-500/15",    text: "text-sky-400",    dot: "bg-sky-400" },
  haiku:    { bg: "bg-emerald-500/15", text: "text-emerald-400", dot: "bg-emerald-400" },
  gemini:   { bg: "bg-amber-500/15",  text: "text-amber-400",  dot: "bg-amber-400" },
  llama:    { bg: "bg-blue-500/15",   text: "text-blue-400",   dot: "bg-blue-400" },
  mistral:  { bg: "bg-orange-500/15", text: "text-orange-400", dot: "bg-orange-400" },
  codestral: { bg: "bg-orange-500/15", text: "text-orange-400", dot: "bg-orange-400" },
  deepseek: { bg: "bg-cyan-500/15",   text: "text-cyan-400",   dot: "bg-cyan-400" },
  qwen:     { bg: "bg-indigo-500/15", text: "text-indigo-400", dot: "bg-indigo-400" },
  kimi:     { bg: "bg-pink-500/15",   text: "text-pink-400",   dot: "bg-pink-400" },
  nemotron: { bg: "bg-lime-500/15",   text: "text-lime-400",   dot: "bg-lime-400" },
  gpt:      { bg: "bg-green-500/15",  text: "text-green-400",  dot: "bg-green-400" },
  devstral: { bg: "bg-orange-500/15", text: "text-orange-400", dot: "bg-orange-400" },
};

const DEFAULT_COLOR: ModelColor = {
  bg: "bg-muted-foreground/10",
  text: "text-muted-foreground",
  dot: "bg-muted-foreground",
};

export function getModelColor(model: string | null | undefined): ModelColor {
  if (!model) return DEFAULT_COLOR;
  const lower = model.toLowerCase();
  for (const [key, color] of Object.entries(MODEL_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return DEFAULT_COLOR;
}

export function getShortModelName(model: string | null | undefined): string | null {
  if (!model) return null;
  return model.split("/").pop()?.slice(0, 28) ?? model;
}

// ── Cost estimation (per 1M tokens) ────────────────────────────────────────

interface ModelPricing {
  input: number;   // $ per 1M input tokens
  output: number;  // $ per 1M output tokens
}

const PRICING: Record<string, ModelPricing> = {
  "opus":           { input: 15,    output: 75 },
  "sonnet-4-6":     { input: 3,     output: 15 },
  "sonnet-4-5":     { input: 3,     output: 15 },
  "haiku":          { input: 0.25,  output: 1.25 },
  "gemini-3-pro":   { input: 1.25,  output: 10 },
  "gemini-3-flash": { input: 0.15,  output: 0.6 },
  "gemini-2.5-pro": { input: 1.25,  output: 10 },
};

export function estimateCost(
  model: string | null | undefined,
  inputTokens: number,
  outputTokens: number,
): number | null {
  if (!model || (inputTokens === 0 && outputTokens === 0)) return null;
  const lower = model.toLowerCase();
  for (const [key, pricing] of Object.entries(PRICING)) {
    if (lower.includes(key)) {
      return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
    }
  }
  // Generic fallback: ~$4/1M average
  return ((inputTokens + outputTokens) * 4) / 1_000_000;
}

// ── Context meter ──────────────────────────────────────────────────────────

const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  "opus":           200_000,
  "sonnet-4-6":     200_000,
  "sonnet-4-5":     200_000,
  "haiku":          200_000,
  "gemini-3-pro":   2_000_000,
  "gemini-3-flash": 1_000_000,
  "gemini-2.5-pro": 1_000_000,
  "llama":          128_000,
  "mistral":        128_000,
  "qwen":           131_072,
  "deepseek":       131_072,
  "kimi":           262_144,
};

export function getContextWindow(model: string | null | undefined): number {
  if (!model) return 200_000;
  const lower = model.toLowerCase();
  for (const [key, window] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
    if (lower.includes(key)) return window;
  }
  return 200_000;
}

export function getContextPercent(
  model: string | null | undefined,
  totalTokens: number,
): number {
  const window = getContextWindow(model);
  return Math.min(100, Math.round((totalTokens / window) * 100));
}
