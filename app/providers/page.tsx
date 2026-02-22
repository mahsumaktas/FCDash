"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useApiQuery } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Layers,
  Search,
  WifiOff,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Brain,
  AlertCircle,
  Type,
  Image,
  AudioLines,
  Video,
} from "lucide-react";
import type { ModelChoice } from "@/lib/types";

// ─── Provider Colors ──────────────────────────────────────────────────────────

const PROVIDER_COLORS: Record<string, string> = {
  openai: "bg-emerald-600",
  anthropic: "bg-orange-500",
  google: "bg-blue-500",
  meta: "bg-indigo-500",
  mistral: "bg-violet-500",
  cohere: "bg-rose-500",
  deepseek: "bg-cyan-600",
  xai: "bg-gray-600",
  groq: "bg-yellow-600",
  together: "bg-pink-500",
  fireworks: "bg-red-500",
  perplexity: "bg-teal-500",
};

const PROVIDER_TEXT_COLORS: Record<string, string> = {
  openai: "text-emerald-600",
  anthropic: "text-orange-500",
  google: "text-blue-500",
  meta: "text-indigo-500",
  mistral: "text-violet-500",
  cohere: "text-rose-500",
  deepseek: "text-cyan-600",
  xai: "text-gray-600",
  groq: "text-yellow-600",
  together: "text-pink-500",
  fireworks: "text-red-500",
  perplexity: "text-teal-500",
};

function getProviderColor(provider: string): string {
  const key = provider.toLowerCase().replace(/[^a-z]/g, "");
  for (const [k, v] of Object.entries(PROVIDER_COLORS)) {
    if (key.includes(k)) return v;
  }
  return "bg-gray-500";
}

function getProviderTextColor(provider: string): string {
  const key = provider.toLowerCase().replace(/[^a-z]/g, "");
  for (const [k, v] of Object.entries(PROVIDER_TEXT_COLORS)) {
    if (key.includes(k)) return v;
  }
  return "text-gray-500";
}

// ─── Types ────────────────────────────────────────────────────────────────────

type UsageWindow = {
  window: string;
  used: number;
  limit: number;
  remaining: number;
  resetsAt?: string;
};

type ProviderUsage = {
  provider: string;
  displayName?: string;
  windows?: UsageWindow[];
  plan?: string;
  error?: string;
};

type UsageStatusResult = {
  providers?: ProviderUsage[];
};

// ─── Input Icons ──────────────────────────────────────────────────────────────

const INPUT_ICONS: Record<string, { icon: typeof Type; label: string }> = {
  text: { icon: Type, label: "Text" },
  image: { icon: Image, label: "Image" },
  audio: { icon: AudioLines, label: "Audio" },
  video: { icon: Video, label: "Video" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatContextWindow(w?: number): string | null {
  if (!w) return null;
  if (w >= 1_000_000) return `${(w / 1_000_000).toFixed(w % 1_000_000 === 0 ? 0 : 1)}M`;
  if (w >= 1_000) return `${(w / 1_000).toFixed(0)}K`;
  return String(w);
}

function formatNumber(n: number | undefined | null): string {
  if (n == null || isNaN(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ─── Provider Card Component ──────────────────────────────────────────────────

function ProviderCard({
  providerName,
  models,
  usage,
}: {
  providerName: string;
  models: ModelChoice[];
  usage?: ProviderUsage;
}) {
  const [expanded, setExpanded] = useState(false);

  const reasoningCount = models.filter((m) => m.reasoning).length;
  const visionCount = models.filter((m) => m.input?.includes("image")).length;
  const maxContext = Math.max(...models.map((m) => m.contextWindow ?? 0), 0);
  const displayName = usage?.displayName || providerName;

  return (
    <Card className="transition-colors hover:bg-accent/20">
      {/* Main card header */}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-lg ${getProviderColor(providerName)} flex items-center justify-center text-white font-bold text-sm shrink-0`}
            >
              {providerName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base font-semibold truncate">
                {displayName}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {models.length} model{models.length !== 1 ? "s" : ""}
                {reasoningCount > 0 && (
                  <span className="ml-2">
                    {reasoningCount} reasoning
                  </span>
                )}
                {visionCount > 0 && (
                  <span className="ml-2">
                    {visionCount} vision
                  </span>
                )}
              </p>
            </div>
          </div>

          {usage?.plan && (
            <Badge variant="secondary" className="text-xs shrink-0">
              {usage.plan}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Stats row */}
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Layers className="w-3 h-3" />
            <span>{models.length} models</span>
          </div>
          {maxContext > 0 && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <span>Max context: {formatContextWindow(maxContext)}</span>
            </div>
          )}
        </div>

        {/* Error banner */}
        {usage?.error && (
          <div className="flex items-start gap-2 p-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-xs">
            <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
            <span className="text-destructive">{usage.error}</span>
          </div>
        )}

        {/* Usage windows / rate limits */}
        {usage?.windows && usage.windows.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Rate Limits
            </p>
            {usage.windows.map((win, winIdx) => {
              const pct =
                win.limit > 0
                  ? Math.min(100, Math.round((win.used / win.limit) * 100))
                  : 0;
              const isHigh = pct > 80;
              return (
                <div key={`${win.window}-${winIdx}`} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{win.window}</span>
                    <span className={isHigh ? "text-destructive font-medium" : ""}>
                      {formatNumber(win.used)} / {formatNumber(win.limit)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isHigh
                          ? "bg-destructive/70"
                          : pct > 50
                          ? "bg-yellow-500/70"
                          : "bg-primary/60"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {win.resetsAt && (
                    <p className="text-[10px] text-muted-foreground">
                      Resets: {new Date(win.resetsAt).toLocaleString()}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpanded((prev) => !prev)}
            className="flex-1"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                Hide Models
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                Show Models ({models.length})
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/models?provider=${encodeURIComponent(providerName)}`}>
              <ExternalLink className="w-3.5 h-3.5" />
              View in Models
            </Link>
          </Button>
        </div>

        {/* Expanded model list */}
        {expanded && (
          <div className="border rounded-md divide-y mt-2">
            {models.map((model) => (
              <div
                key={model.id}
                className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent/30 transition-colors"
              >
                {/* Model name & id */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{model.name}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {model.id}
                  </p>
                </div>

                {/* Context window */}
                {model.contextWindow ? (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatContextWindow(model.contextWindow)} ctx
                  </span>
                ) : null}

                {/* Reasoning badge */}
                {model.reasoning && (
                  <Badge variant="secondary" className="text-xs shrink-0">
                    <Brain className="w-3 h-3" />
                    Reasoning
                  </Badge>
                )}

                {/* Input modality icons */}
                {model.input && model.input.length > 0 && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    {model.input.map((inp) => {
                      const entry = INPUT_ICONS[inp.toLowerCase()];
                      if (!entry) return null;
                      const Icon = entry.icon;
                      return (
                        <span
                          key={inp}
                          title={entry.label}
                          className="inline-flex items-center justify-center w-5 h-5 rounded bg-muted text-muted-foreground"
                        >
                          <Icon className="w-3 h-3" />
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function ProvidersPage() {
  const { data: modelsData, loading: modelsLoading, error: modelsError, refetch: refetchModels } = useApiQuery({
    method: "models.list",
    pollInterval: 0,
  });
  const { data: usageData, loading: usageLoading, error: usageError, refetch: refetchUsage } = useApiQuery({
    method: "usage.status",
    pollInterval: 0,
  });

  const loading = modelsLoading || usageLoading;
  const error = modelsError || usageError;
  const models = modelsData?.models ?? [];
  const usageResult = usageData as UsageStatusResult | null;
  const usageProviders = Array.isArray(usageResult?.providers) ? usageResult.providers : [];
  const [search, setSearch] = useState("");

  // Group models by provider
  const providerGroups = useMemo(() => {
    const groups: Record<string, ModelChoice[]> = {};
    for (const model of models) {
      const provider = model.provider || "Unknown";
      if (!groups[provider]) groups[provider] = [];
      groups[provider].push(model);
    }
    return groups;
  }, [models]);

  // Build usage lookup
  const usageLookup = useMemo(() => {
    const map: Record<string, ProviderUsage> = {};
    for (const p of usageProviders) {
      map[p.provider] = p;
    }
    return map;
  }, [usageProviders]);

  // Merge: all providers (from models + usage)
  const allProviders = useMemo(() => {
    const providerSet = new Set<string>();
    Object.keys(providerGroups).forEach((p) => providerSet.add(p));
    usageProviders.forEach((p) => providerSet.add(p.provider));

    let providers = Array.from(providerSet).sort((a, b) =>
      a.localeCompare(b)
    );

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      providers = providers.filter(
        (p) =>
          p.toLowerCase().includes(q) ||
          (usageLookup[p]?.displayName?.toLowerCase().includes(q) ?? false)
      );
    }

    return providers;
  }, [providerGroups, usageProviders, usageLookup, search]);

  // Stats
  const totalModels = models.length;
  const totalProviders = new Set([
    ...Object.keys(providerGroups),
    ...usageProviders.map((p) => p.provider),
  ]).size;
  const errorCount = usageProviders.filter((p) => p.error).length;

  // ─── Not Connected ──────────────────────────────────────────────────────────

  if (error && !models.length) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full text-muted-foreground">
        <WifiOff className="w-16 h-16 mb-4 opacity-20" />
        <h2 className="text-lg font-medium mb-1">Unable to Load Providers</h2>
        <p className="text-sm">{error.message}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => { refetchModels(); refetchUsage(); }}>
          Try Again
        </Button>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Providers</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {loading ? (
            "Loading provider information..."
          ) : (
            <>
              <span className="font-medium text-foreground">
                {totalProviders}
              </span>{" "}
              providers serving{" "}
              <span className="font-medium text-foreground">
                {totalModels}
              </span>{" "}
              models
              {errorCount > 0 && (
                <span className="text-destructive ml-2">
                  ({errorCount} with errors)
                </span>
              )}
            </>
          )}
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search providers..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-1.5 w-full" />
                <Skeleton className="h-1.5 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-8 w-32" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : allProviders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Layers className="w-16 h-16 mb-4 opacity-20" />
          <p className="text-sm">
            {search
              ? "No providers match your search."
              : "No providers available."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {allProviders.map((providerName) => (
            <ProviderCard
              key={providerName}
              providerName={providerName}
              models={providerGroups[providerName] ?? []}
              usage={usageLookup[providerName]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
