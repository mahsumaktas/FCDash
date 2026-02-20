"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useGatewayStore } from "@/stores/gateway";
import { useIsConnected } from "@/hooks/use-gateway";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Cpu, Search, Brain, WifiOff } from "lucide-react";
import { toast } from "sonner";
import type { ModelChoice } from "@/lib/types";

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

function getProviderColor(provider: string): string {
  const key = provider.toLowerCase().replace(/[^a-z]/g, "");
  for (const [k, v] of Object.entries(PROVIDER_COLORS)) {
    if (key.includes(k)) return v;
  }
  return "bg-gray-500";
}

export default function ModelsPage() {
  const rpc = useGatewayStore((s) => s.rpc);
  const isConnected = useIsConnected();

  const [models, setModels] = useState<ModelChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchModels = useCallback(async () => {
    if (!isConnected) return;
    try {
      const result = await rpc("models.list");
      setModels(result);
    } catch {
      toast.error("Failed to load models");
    } finally {
      setLoading(false);
    }
  }, [isConnected, rpc]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const filtered = useMemo(() => {
    if (!search.trim()) return models;
    const q = search.toLowerCase();
    return models.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q)
    );
  }, [models, search]);

  // Group by provider
  const grouped = useMemo(() => {
    const groups: Record<string, ModelChoice[]> = {};
    for (const model of filtered) {
      const provider = model.provider || "Unknown";
      if (!groups[provider]) groups[provider] = [];
      groups[provider].push(model);
    }
    // Sort providers alphabetically
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const formatContextWindow = (w?: number) => {
    if (!w) return null;
    if (w >= 1_000_000) return `${(w / 1_000_000).toFixed(0)}M`;
    if (w >= 1_000) return `${(w / 1_000).toFixed(0)}K`;
    return String(w);
  };

  if (!isConnected) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full text-muted-foreground">
        <WifiOff className="w-16 h-16 mb-4 opacity-20" />
        <h2 className="text-lg font-medium mb-1">Not Connected</h2>
        <p className="text-sm">Waiting for gateway connection...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Models</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Browse available AI models ({models.length} total)
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search models..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Cpu className="w-16 h-16 mb-4 opacity-20" />
          <p className="text-sm">
            {search ? "No models match your search." : "No models available."}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([provider, providerModels]) => (
            <div key={provider}>
              <div className="flex items-center gap-2 mb-3">
                <Badge className={`${getProviderColor(provider)} text-white`}>
                  {provider}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {providerModels.length} model{providerModels.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {providerModels.map((model) => (
                  <Card key={model.id} className="hover:bg-accent/30 transition-colors">
                    <CardHeader className="pb-0">
                      <CardTitle className="text-sm font-medium truncate">
                        {model.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground font-mono mb-2 truncate">
                        {model.id}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {model.contextWindow && (
                          <Badge variant="outline" className="text-xs">
                            {formatContextWindow(model.contextWindow)} ctx
                          </Badge>
                        )}
                        {model.reasoning && (
                          <Badge variant="secondary" className="text-xs">
                            <Brain className="w-3 h-3" />
                            Reasoning
                          </Badge>
                        )}
                        {model.input?.map((inp) => (
                          <Badge key={inp} variant="outline" className="text-xs">
                            {inp}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
