"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useApiQuery } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Cpu,
  Search,
  Brain,
  WifiOff,
  Type,
  Image,
  AudioLines,
  Video,
  ArrowUpDown,
  Layers,
  CheckCircle2,
} from "lucide-react";
import type { ModelChoice } from "@/lib/types";

// ─── Provider Colors ──────────────────────────────────────────────────────────

export const PROVIDER_COLORS: Record<string, string> = {
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

export function getProviderColor(provider: string): string {
  const key = provider.toLowerCase().replace(/[^a-z]/g, "");
  for (const [k, v] of Object.entries(PROVIDER_COLORS)) {
    if (key.includes(k)) return v;
  }
  return "bg-gray-500";
}

// ─── Filter & Sort Types ──────────────────────────────────────────────────────

type FilterType = "all" | "reasoning" | "vision" | "large-context";
type SortType = "name" | "context" | "provider";

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "reasoning", label: "Reasoning" },
  { value: "vision", label: "Vision" },
  { value: "large-context", label: "Large Context (>100K)" },
];

const SORT_OPTIONS: { value: SortType; label: string }[] = [
  { value: "name", label: "By Name" },
  { value: "context", label: "By Context Window" },
  { value: "provider", label: "By Provider" },
];

// ─── Input Modality Icons ─────────────────────────────────────────────────────

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

// ─── Page Component ───────────────────────────────────────────────────────────

function ModelsPageInner() {
  const searchParams = useSearchParams();

  const { data: modelsData, loading, error, refetch } = useApiQuery({
    method: "models.list",
    pollInterval: 0,
  });
  const models = modelsData?.models ?? [];

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("provider");

  // Pick up ?provider=X from URL (e.g. coming from Providers page)
  const urlProvider = searchParams.get("provider");

  useEffect(() => {
    if (urlProvider) {
      setSearch(urlProvider);
    }
  }, [urlProvider]);

  // Max context window for visual bar scaling
  const maxContext = useMemo(() => {
    let max = 0;
    for (const m of models) {
      if (m.contextWindow && m.contextWindow > max) max = m.contextWindow;
    }
    return max || 1;
  }, [models]);

  // Count unique providers
  const providerCount = useMemo(() => {
    const providers = new Set(models.map((m) => m.provider));
    return providers.size;
  }, [models]);

  // Apply search + filter
  const filtered = useMemo(() => {
    let result = models;

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q) ||
          m.provider.toLowerCase().includes(q)
      );
    }

    // Category filter
    switch (filter) {
      case "reasoning":
        result = result.filter((m) => m.reasoning);
        break;
      case "vision":
        result = result.filter((m) => m.input?.includes("image"));
        break;
      case "large-context":
        result = result.filter((m) => (m.contextWindow ?? 0) > 100_000);
        break;
    }

    return result;
  }, [models, search, filter]);

  // Sort
  const sorted = useMemo(() => {
    const items = [...filtered];
    switch (sort) {
      case "name":
        items.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "context":
        items.sort((a, b) => (b.contextWindow ?? 0) - (a.contextWindow ?? 0));
        break;
      case "provider":
        items.sort((a, b) => {
          const pCmp = a.provider.localeCompare(b.provider);
          return pCmp !== 0 ? pCmp : a.name.localeCompare(b.name);
        });
        break;
    }
    return items;
  }, [filtered, sort]);

  // Group by provider (only used when sort is "provider")
  const grouped = useMemo(() => {
    if (sort !== "provider") return null;
    const groups: Record<string, ModelChoice[]> = {};
    for (const model of sorted) {
      const provider = model.provider || "Unknown";
      if (!groups[provider]) groups[provider] = [];
      groups[provider].push(model);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [sorted, sort]);

  // ─── Not Connected State ──────────────────────────────────────────────────

  if (error && !models.length) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full text-muted-foreground">
        <WifiOff className="w-16 h-16 mb-4 opacity-20" />
        <h2 className="text-lg font-medium mb-1">Unable to Load Models</h2>
        <p className="text-sm">{error.message}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={refetch}>
          Try Again
        </Button>
      </div>
    );
  }

  // ─── Model Card ───────────────────────────────────────────────────────────

  function ModelCard({ model }: { model: ModelChoice }) {
    const ctxPercent = model.contextWindow
      ? Math.round((model.contextWindow / maxContext) * 100)
      : 0;

    return (
      <Card className="hover:bg-accent/30 transition-colors group">
        <CardHeader className="pb-0">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm font-medium truncate">
              {model.name}
            </CardTitle>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5 opacity-60 group-hover:opacity-100 transition-opacity" />
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5">
          <p className="text-xs text-muted-foreground font-mono truncate">
            {model.id}
          </p>

          {/* Context window bar */}
          {model.contextWindow ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Context</span>
                <span className="font-medium">
                  {formatContextWindow(model.contextWindow)}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary/60 transition-all"
                  style={{ width: `${ctxPercent}%` }}
                />
              </div>
            </div>
          ) : null}

          {/* Badges row */}
          <div className="flex flex-wrap gap-1.5">
            {model.reasoning && (
              <Badge variant="secondary" className="text-xs">
                <Brain className="w-3 h-3" />
                Reasoning
              </Badge>
            )}

            {/* Input modality icons */}
            {model.input && model.input.length > 0 && (
              <div className="flex items-center gap-1">
                {model.input.map((inp) => {
                  const entry = INPUT_ICONS[inp.toLowerCase()];
                  if (!entry) {
                    return (
                      <Badge key={inp} variant="outline" className="text-xs">
                        {inp}
                      </Badge>
                    );
                  }
                  const Icon = entry.icon;
                  return (
                    <span
                      key={inp}
                      title={entry.label}
                      className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Models</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Browse available AI models --{" "}
          <span className="font-medium text-foreground">{models.length}</span>{" "}
          models across{" "}
          <span className="font-medium text-foreground">{providerCount}</span>{" "}
          providers
        </p>
      </div>

      {/* Search + Sort Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search models, providers..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
          <Select value={sort} onValueChange={(v: string) => setSort(v as SortType)}>
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={filter === opt.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(opt.value)}
          >
            {opt.label}
            {opt.value !== "all" && (
              <span className="ml-1 text-xs opacity-70">
                (
                {opt.value === "reasoning"
                  ? models.filter((m) => m.reasoning).length
                  : opt.value === "vision"
                  ? models.filter((m) => m.input?.includes("image")).length
                  : models.filter((m) => (m.contextWindow ?? 0) > 100_000)
                      .length}
                )
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-3 w-56" />
                <Skeleton className="h-1.5 w-full" />
                <Skeleton className="h-5 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Cpu className="w-16 h-16 mb-4 opacity-20" />
          <p className="text-sm">
            {search || filter !== "all"
              ? "No models match your filters."
              : "No models available."}
          </p>
        </div>
      ) : grouped ? (
        /* Grouped by provider view */
        <div className="space-y-8">
          {grouped.map(([provider, providerModels]) => (
            <div key={provider}>
              <div className="flex items-center gap-2 mb-3">
                <Badge className={`${getProviderColor(provider)} text-white`}>
                  {provider}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {providerModels.length} model
                  {providerModels.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {providerModels.map((model) => (
                  <ModelCard key={model.id} model={model} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Flat sorted view (name or context sort) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sorted.map((model) => (
            <div key={model.id} className="relative">
              {/* Small provider badge in corner for non-grouped views */}
              <div className="absolute top-2 right-2 z-10">
                <Badge
                  className={`${getProviderColor(model.provider)} text-white text-[10px] px-1.5 py-0`}
                >
                  {model.provider}
                </Badge>
              </div>
              <ModelCard model={model} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ModelsPage() {
  return (
    <Suspense fallback={null}>
      <ModelsPageInner />
    </Suspense>
  );
}
