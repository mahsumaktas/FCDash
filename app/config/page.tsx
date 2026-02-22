"use client";

import { useState, useEffect, useMemo } from "react";
import { useApiQuery } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
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
  FileText,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

export default function ConfigPage() {
  const { data, loading, error, refetch } = useApiQuery({
    method: "config.get",
    pollInterval: 0,
  });

  const rawConfig = data?.raw ?? "";
  const configHash = data?.hash ?? "";
  const configPath = data?.path ?? "";
  const configExists = data?.exists ?? false;
  const configValid = data?.valid ?? true;
  const issues = data?.issues ?? [];
  const warnings = data?.warnings ?? [];

  const [editedConfig, setEditedConfig] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  // Sync editedConfig when fresh data arrives (initial load, reload, after save)
  useEffect(() => {
    if (data?.raw != null) {
      setEditedConfig(data.raw);
    }
  }, [data?.raw]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.rpc("config.set", { raw: editedConfig, baseHash: configHash });
      toast.success("Configuration saved");
      // Re-fetch to get the updated hash and validation state
      await refetch();
    } catch {
      toast.error("Failed to save config");
    } finally {
      setSaving(false);
    }
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(editedConfig);
      setEditedConfig(JSON.stringify(parsed, null, 2));
    } catch {
      toast.error("Cannot format: invalid JSON");
    }
  };

  const hasChanges = editedConfig !== rawConfig;

  // Filter lines of the config for search
  const displayConfig = useMemo(() => {
    if (!search.trim()) return editedConfig;
    const q = search.toLowerCase();
    const lines = editedConfig.split("\n");
    const filtered = lines.filter((line) => line.toLowerCase().includes(q));
    return filtered.join("\n");
  }, [editedConfig, search]);

  const isSearching = search.trim().length > 0;

  if (error && !data) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full text-muted-foreground">
        <WifiOff className="w-16 h-16 mb-4 opacity-20" />
        <h2 className="text-lg font-medium mb-1">Unable to Load Configuration</h2>
        <p className="text-sm">{error.message}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={refetch}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Configuration</h1>
          <p className="text-muted-foreground text-sm mt-1">
            View and edit gateway configuration
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refetch}
            disabled={loading}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Reload
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleFormat}
            disabled={loading || isSearching}
          >
            Format
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !hasChanges || isSearching}
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Status bar */}
      {!loading && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {configPath && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <FileText className="w-3.5 h-3.5" />
              <span className="font-mono text-xs">{configPath}</span>
            </div>
          )}
          {configExists ? (
            configValid ? (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle className="w-3 h-3 text-green-500" />
                Valid
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="w-3 h-3" />
                Invalid
              </Badge>
            )
          ) : (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              No config file
            </Badge>
          )}
          {hasChanges && (
            <Badge variant="outline" className="gap-1 text-yellow-500 border-yellow-500/30">
              Unsaved changes
            </Badge>
          )}
        </div>
      )}

      {/* Issues */}
      {issues.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <AlertCircle className="w-4 h-4" />
              Issues ({issues.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-1">
            {issues.map((issue, i) => (
              <div key={i} className="text-xs font-mono">
                <span className="text-muted-foreground">{issue.path}:</span>{" "}
                {issue.message}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <Card className="border-yellow-500/50">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2 text-yellow-500">
              <AlertTriangle className="w-4 h-4" />
              Warnings ({warnings.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-1">
            {warnings.map((warning, i) => (
              <div key={i} className="text-xs font-mono">
                <span className="text-muted-foreground">{warning.path}:</span>{" "}
                {warning.message}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search config..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Config editor */}
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
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !configExists && !rawConfig ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Settings className="w-16 h-16 mb-4 opacity-20" />
          <p className="text-sm">No configuration file found.</p>
          <p className="text-xs mt-1">
            Create a config file at <span className="font-mono">{configPath || "the expected path"}</span> to get started.
          </p>
        </div>
      ) : isSearching ? (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm text-muted-foreground">
              Filtered results ({displayConfig.split("\n").length} lines matching)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="font-mono text-xs whitespace-pre-wrap bg-muted/30 rounded p-4 overflow-auto max-h-[70vh]">
              {displayConfig || "No matching lines."}
            </pre>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Textarea
              className="font-mono text-xs min-h-[500px] resize-y w-full"
              value={editedConfig}
              onChange={(e) => setEditedConfig(e.target.value)}
              spellCheck={false}
              placeholder="Paste or type your JSON configuration here..."
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
