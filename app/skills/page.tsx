"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useGatewayStore } from "@/stores/gateway";
import { useIsConnected } from "@/hooks/use-gateway";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Puzzle,
  Search,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import type { SkillInfo } from "@/lib/types";

export default function SkillsPage() {
  const rpc = useGatewayStore((s) => s.rpc);
  const isConnected = useIsConnected();

  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [installing, setInstalling] = useState<Record<string, boolean>>({});

  const fetchSkills = useCallback(async () => {
    if (!isConnected) return;
    try {
      const result = await rpc("skills.status");
      setSkills(result.skills ?? []);
    } catch {
      toast.error("Failed to load skills");
    } finally {
      setLoading(false);
    }
  }, [isConnected, rpc]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const filtered = useMemo(() => {
    if (!search.trim()) return skills;
    const q = search.toLowerCase();
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.skillKey.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.source?.toLowerCase().includes(q)
    );
  }, [skills, search]);

  const handleInstall = async (skill: SkillInfo) => {
    if (!skill.install?.length) return;
    const installId = skill.install[0].id;
    setInstalling((prev) => ({ ...prev, [skill.skillKey]: true }));
    try {
      await rpc("skills.install", { id: installId });
      toast.success(`Installed "${skill.name}"`);
      fetchSkills();
    } catch {
      toast.error(`Failed to install "${skill.name}"`);
    } finally {
      setInstalling((prev) => {
        const next = { ...prev };
        delete next[skill.skillKey];
        return next;
      });
    }
  };

  const getSkillStatus = (skill: SkillInfo): "ready" | "disabled" | "missing" => {
    if (skill.disabled) return "disabled";
    if (skill.missing && Object.values(skill.missing).some((v) => v && v.length > 0)) return "missing";
    return "ready";
  };

  const getStatusBadge = (skill: SkillInfo) => {
    const status = getSkillStatus(skill);
    switch (status) {
      case "ready":
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">
            <CheckCircle2 className="w-3 h-3" />
            Ready
          </Badge>
        );
      case "disabled":
        return (
          <Badge variant="secondary">
            <AlertTriangle className="w-3 h-3" />
            Disabled
          </Badge>
        );
      case "missing":
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3" />
            Missing
          </Badge>
        );
    }
  };

  const getMissingList = (skill: SkillInfo): string[] => {
    if (!skill.missing) return [];
    const items: string[] = [];
    if (skill.missing.bins?.length) items.push(...skill.missing.bins.map((b) => `bin: ${b}`));
    if (skill.missing.anyBins?.length) items.push(`any of: ${skill.missing.anyBins.join(", ")}`);
    if (skill.missing.env?.length) items.push(...skill.missing.env.map((e) => `env: ${e}`));
    if (skill.missing.config?.length) items.push(...skill.missing.config.map((c) => `config: ${c}`));
    if (skill.missing.os?.length) items.push(...skill.missing.os.map((o) => `os: ${o}`));
    return items;
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
        <h1 className="text-2xl font-bold">Skills</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Skill registry ({skills.length} total)
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search skills..."
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
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-48" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Puzzle className="w-16 h-16 mb-4 opacity-20" />
          <p className="text-sm">
            {search ? "No skills match your search." : "No skills registered."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((skill) => {
            const missingItems = getMissingList(skill);
            const status = getSkillStatus(skill);

            return (
              <Card key={skill.skillKey} className="hover:bg-accent/30 transition-colors">
                <CardHeader className="pb-0">
                  <CardTitle className="text-base flex items-center gap-2">
                    {skill.emoji ? (
                      <span className="text-lg">{skill.emoji}</span>
                    ) : (
                      <Puzzle className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="truncate">{skill.name}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {skill.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {skill.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    {getStatusBadge(skill)}
                    {skill.source && (
                      <Badge variant="outline" className="text-xs">
                        {skill.source}
                      </Badge>
                    )}
                    {skill.bundled && (
                      <Badge variant="outline" className="text-xs">
                        Bundled
                      </Badge>
                    )}
                  </div>

                  {/* Missing requirements */}
                  {status === "missing" && missingItems.length > 0 && (
                    <div className="text-xs space-y-0.5">
                      <span className="text-muted-foreground">Missing:</span>
                      {missingItems.map((item, i) => (
                        <div key={i} className="text-destructive font-mono pl-2">
                          {item}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Install button */}
                  {skill.install && skill.install.length > 0 && status === "missing" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleInstall(skill)}
                      disabled={installing[skill.skillKey]}
                    >
                      <Download className="w-4 h-4" />
                      {installing[skill.skillKey] ? "Installing..." : "Install"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
