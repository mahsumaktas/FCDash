"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useGatewayStore } from "@/stores/gateway";
import { useIsConnected } from "@/hooks/use-gateway";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Settings,
  Search,
  Save,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import type { ConfigEntry } from "@/lib/types";

const SENSITIVE_PATTERNS = ["token", "password", "secret", "key", "api_key", "apikey", "auth"];

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_PATTERNS.some((p) => lower.includes(p));
}

function getSection(key: string): string {
  const dot = key.indexOf(".");
  return dot > 0 ? key.slice(0, dot) : "general";
}

export default function ConfigPage() {
  const rpc = useGatewayStore((s) => s.rpc);
  const isConnected = useIsConnected();

  const [entries, setEntries] = useState<ConfigEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());

  const fetchConfig = useCallback(async () => {
    if (!isConnected) return;
    try {
      const result = await rpc("config.get");
      if (Array.isArray(result)) {
        setEntries(result);
        // Expand all sections initially
        const sections = new Set(result.map((e) => getSection(e.key)));
        setExpandedSections(sections);
      }
    } catch {
      toast.error("Failed to load config");
    } finally {
      setLoading(false);
    }
  }, [isConnected, rpc]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter(
      (e) =>
        e.key.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q) ||
        String(e.value).toLowerCase().includes(q)
    );
  }, [entries, search]);

  // Group by section
  const grouped = useMemo(() => {
    const groups: Record<string, ConfigEntry[]> = {};
    for (const entry of filtered) {
      const section = getSection(entry.key);
      if (!groups[section]) groups[section] = [];
      groups[section].push(entry);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const startEdit = (entry: ConfigEntry) => {
    setEditingKey(entry.key);
    const val = entry.value;
    if (typeof val === "object") {
      setEditValue(JSON.stringify(val, null, 2));
    } else {
      setEditValue(String(val ?? ""));
    }
  };

  const handleSave = async () => {
    if (!editingKey) return;
    setSaving(true);
    try {
      let parsedValue: unknown = editValue;
      // Try to parse as JSON for complex types
      try {
        parsedValue = JSON.parse(editValue);
      } catch {
        // Keep as string if not valid JSON
        // Also try to parse numbers and booleans
        if (editValue === "true") parsedValue = true;
        else if (editValue === "false") parsedValue = false;
        else if (editValue !== "" && !isNaN(Number(editValue)))
          parsedValue = Number(editValue);
      }

      await rpc("config.set", { key: editingKey, value: parsedValue });
      toast.success(`Config "${editingKey}" updated`);

      // Update local state
      setEntries((prev) =>
        prev.map((e) =>
          e.key === editingKey ? { ...e, value: parsedValue } : e
        )
      );
      setEditingKey(null);
      setEditValue("");
    } catch {
      toast.error("Failed to save config");
    } finally {
      setSaving(false);
    }
  };

  const toggleReveal = (key: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const displayValue = (entry: ConfigEntry): string => {
    if (isSensitiveKey(entry.key) && !revealedKeys.has(entry.key)) {
      return "********";
    }
    if (entry.value === null || entry.value === undefined) return "";
    if (typeof entry.value === "object") return JSON.stringify(entry.value);
    return String(entry.value);
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
        <h1 className="text-2xl font-bold">Configuration</h1>
        <p className="text-muted-foreground text-sm mt-1">
          View and edit gateway configuration ({entries.length} entries)
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search config keys..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-24" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Settings className="w-16 h-16 mb-4 opacity-20" />
          <p className="text-sm">
            {search ? "No config entries match your search." : "No configuration entries found."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([section, sectionEntries]) => {
            const isExpanded = expandedSections.has(section);
            return (
              <Card key={section}>
                <CardHeader
                  className="cursor-pointer select-none"
                  onClick={() => toggleSection(section)}
                >
                  <CardTitle className="text-base flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    <span className="capitalize">{section}</span>
                    <Badge variant="secondary" className="text-xs">
                      {sectionEntries.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                {isExpanded && (
                  <CardContent className="space-y-3 border-t border-border pt-4">
                    {sectionEntries.map((entry) => {
                      const isEditing = editingKey === entry.key;
                      const sensitive = isSensitiveKey(entry.key);
                      const isComplex = typeof entry.value === "object" && entry.value !== null;

                      return (
                        <div key={entry.key} className="space-y-1.5 pb-3 border-b border-border/50 last:border-0 last:pb-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono font-medium">{entry.key}</span>
                            {sensitive && (
                              <Badge variant="outline" className="text-xs text-yellow-500 border-yellow-500/30">
                                Sensitive
                              </Badge>
                            )}
                            {entry.type && (
                              <Badge variant="outline" className="text-xs">
                                {entry.type}
                              </Badge>
                            )}
                          </div>
                          {entry.description && (
                            <p className="text-xs text-muted-foreground">{entry.description}</p>
                          )}
                          {isEditing ? (
                            <div className="space-y-2">
                              {isComplex ? (
                                <Textarea
                                  className="font-mono text-xs min-h-[80px]"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                />
                              ) : (
                                <Input
                                  className="font-mono text-sm"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  type={sensitive && !revealedKeys.has(entry.key) ? "password" : "text"}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSave();
                                    if (e.key === "Escape") {
                                      setEditingKey(null);
                                      setEditValue("");
                                    }
                                  }}
                                />
                              )}
                              <div className="flex gap-2">
                                <Button size="sm" onClick={handleSave} disabled={saving}>
                                  <Save className="w-3 h-3" />
                                  {saving ? "Saving..." : "Save"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingKey(null);
                                    setEditValue("");
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div
                                className="flex-1 text-sm font-mono bg-muted/30 rounded px-2 py-1 cursor-pointer hover:bg-muted/50 transition-colors truncate"
                                onClick={() => startEdit(entry)}
                                title="Click to edit"
                              >
                                {displayValue(entry) || <span className="text-muted-foreground italic">empty</span>}
                              </div>
                              {sensitive && (
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={() => toggleReveal(entry.key)}
                                  title={revealedKeys.has(entry.key) ? "Hide" : "Reveal"}
                                >
                                  {revealedKeys.has(entry.key) ? (
                                    <EyeOff className="w-3 h-3" />
                                  ) : (
                                    <Eye className="w-3 h-3" />
                                  )}
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
