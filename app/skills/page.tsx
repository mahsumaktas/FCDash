"use client";

import { useState, useMemo } from "react";
import { useApiQuery } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Puzzle,
  Search,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  WifiOff,
  ShieldCheck,
  Users,
  ShieldAlert,
  Package,
  FolderOpen,
  Terminal,
  RefreshCw,
  Loader2,
  Filter,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import type { SkillInfo } from "@/lib/types";

// ─── Filter types ────────────────────────────────────────────────────────────

type FilterPill =
  | "all"
  | "enabled"
  | "disabled"
  | "bundled"
  | "community"
  | "issues";

type SortMode = "name" | "source";

// ─── Skill status classification ─────────────────────────────────────────────

type SkillStatus = "ready" | "disabled" | "blocked" | "missing";

function classifySkill(skill: SkillInfo): SkillStatus {
  if (skill.blockedByAllowlist) return "blocked";
  if (skill.disabled) return "disabled";
  if (
    skill.missing &&
    Object.values(skill.missing).some((v) => v && v.length > 0)
  )
    return "missing";
  return "ready";
}

function hasMissing(skill: SkillInfo): boolean {
  if (!skill.missing) return false;
  return Object.values(skill.missing).some((v) => v && v.length > 0);
}

function hasIssues(skill: SkillInfo): boolean {
  return (
    skill.blockedByAllowlist === true ||
    skill.disabled === true ||
    hasMissing(skill)
  );
}

function getMissingList(skill: SkillInfo): string[] {
  if (!skill.missing) return [];
  const items: string[] = [];
  if (skill.missing.bins?.length)
    items.push(...skill.missing.bins.map((b) => `binary: ${b}`));
  if (skill.missing.anyBins?.length)
    items.push(`any binary: ${skill.missing.anyBins.join(", ")}`);
  if (skill.missing.env?.length)
    items.push(...skill.missing.env.map((e) => `env var: ${e}`));
  if (skill.missing.config?.length)
    items.push(...skill.missing.config.map((c) => `config: ${c}`));
  if (skill.missing.os?.length)
    items.push(...skill.missing.os.map((o) => `platform: ${o}`));
  return items;
}

function getRequirementsList(skill: SkillInfo): string[] {
  if (!skill.requirements) return [];
  const items: string[] = [];
  if (skill.requirements.bins?.length)
    items.push(...skill.requirements.bins.map((b) => `binary: ${b}`));
  if (skill.requirements.anyBins?.length)
    items.push(`any of: ${skill.requirements.anyBins.join(", ")}`);
  if (skill.requirements.env?.length)
    items.push(...skill.requirements.env.map((e) => `env: ${e}`));
  if (skill.requirements.config?.length)
    items.push(...skill.requirements.config.map((c) => `config: ${c}`));
  if (skill.requirements.os?.length)
    items.push(...skill.requirements.os.map((o) => `platform: ${o}`));
  return items;
}

// ─── Filter pill config ──────────────────────────────────────────────────────

const FILTER_PILLS: { id: FilterPill; label: string }[] = [
  { id: "all", label: "All" },
  { id: "enabled", label: "Enabled" },
  { id: "disabled", label: "Disabled" },
  { id: "bundled", label: "Bundled" },
  { id: "community", label: "Community" },
  { id: "issues", label: "Has Issues" },
];

// ─── Main Page Component ─────────────────────────────────────────────────────

export default function SkillsPage() {
  const { data: statusData, loading, error, refetch } = useApiQuery({
    method: "skills.status",
    pollInterval: 0,
  });
  const skills = statusData?.skills ?? [];
  const workspaceDir = statusData?.workspaceDir;
  const managedSkillsDir = statusData?.managedSkillsDir;

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterPill>("all");
  const [sortMode, setSortMode] = useState<SortMode>("name");
  const [installing, setInstalling] = useState<Record<string, boolean>>({});
  const [installConfirm, setInstallConfirm] = useState<SkillInfo | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
    toast.success("Skills refreshed");
  };

  const handleInstall = async (skill: SkillInfo) => {
    if (!skill.install?.length) return;
    const installId = skill.install[0].id;
    setInstallConfirm(null);
    setInstalling((prev) => ({ ...prev, [skill.skillKey]: true }));
    try {
      await api.rpc("skills.install", { id: installId });
      toast.success(`Installed "${skill.name}"`);
      refetch();
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

  const toggleExpanded = (key: string) => {
    setExpandedCards((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ─── Computed stats ──────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = skills.length;
    const enabled = skills.filter((s) => !s.disabled && !s.blockedByAllowlist).length;
    const disabled = skills.filter((s) => s.disabled).length;
    const withIssues = skills.filter(hasIssues).length;
    const bundled = skills.filter((s) => s.bundled).length;
    const community = skills.filter((s) => !s.bundled).length;
    const installable = skills.filter(
      (s) => s.install && s.install.length > 0
    ).length;
    return { total, enabled, disabled, withIssues, bundled, community, installable };
  }, [skills]);

  // ─── Filtered + sorted skills ────────────────────────────────────────────────

  const filteredSkills = useMemo(() => {
    let result = [...skills];

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.skillKey.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q) ||
          s.source?.toLowerCase().includes(q)
      );
    }

    // Filter pill
    switch (filter) {
      case "enabled":
        result = result.filter((s) => !s.disabled && !s.blockedByAllowlist);
        break;
      case "disabled":
        result = result.filter((s) => s.disabled);
        break;
      case "bundled":
        result = result.filter((s) => s.bundled);
        break;
      case "community":
        result = result.filter((s) => !s.bundled);
        break;
      case "issues":
        result = result.filter(hasIssues);
        break;
    }

    // Sort
    result.sort((a, b) => {
      if (sortMode === "name") {
        return a.name.localeCompare(b.name);
      }
      return (a.source ?? "").localeCompare(b.source ?? "");
    });

    return result;
  }, [skills, search, filter, sortMode]);

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (error && !skills.length) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full text-muted-foreground">
        <WifiOff className="w-16 h-16 mb-4 opacity-20" />
        <h2 className="text-lg font-medium mb-1">Unable to Load Skills</h2>
        <p className="text-sm">{error.message}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={refetch}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Skills</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Skill registry and management
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        {/* Stats bar */}
        {!loading && stats.total > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <StatCard label="Total" value={stats.total} />
            <StatCard
              label="Enabled"
              value={stats.enabled}
              color="text-emerald-400"
            />
            <StatCard
              label="Disabled"
              value={stats.disabled}
              color="text-muted-foreground"
            />
            <StatCard
              label="Issues"
              value={stats.withIssues}
              color={stats.withIssues > 0 ? "text-red-400" : "text-muted-foreground"}
            />
            <StatCard
              label="Bundled"
              value={stats.bundled}
              color="text-blue-400"
            />
            <StatCard
              label="Community"
              value={stats.community}
              color="text-purple-400"
            />
            <StatCard
              label="Installable"
              value={stats.installable}
              color="text-orange-400"
            />
          </div>
        )}

        {/* Search + Filters */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search input */}
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search skills..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Sort selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                Sort:
              </span>
              <Button
                variant={sortMode === "name" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setSortMode("name")}
              >
                Name
              </Button>
              <Button
                variant={sortMode === "source" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setSortMode("source")}
              >
                Source
              </Button>
            </div>
          </div>

          {/* Filter pills */}
          <div className="flex flex-wrap gap-2">
            {FILTER_PILLS.map((pill) => {
              const isActive = filter === pill.id;
              const count =
                pill.id === "all"
                  ? stats.total
                  : pill.id === "enabled"
                  ? stats.enabled
                  : pill.id === "disabled"
                  ? stats.disabled
                  : pill.id === "bundled"
                  ? stats.bundled
                  : pill.id === "community"
                  ? stats.community
                  : stats.withIssues;

              return (
                <Button
                  key={pill.id}
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setFilter(pill.id)}
                  className={`text-xs ${
                    isActive ? "border border-border" : ""
                  }`}
                >
                  {pill.id === "issues" && count > 0 && (
                    <AlertTriangle className="w-3 h-3 text-red-400" />
                  )}
                  {pill.id === "bundled" && (
                    <ShieldCheck className="w-3 h-3" />
                  )}
                  {pill.id === "community" && <Users className="w-3 h-3" />}
                  {pill.label}
                  <span className="text-muted-foreground ml-1">({count})</span>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Workspace info */}
        {!loading && (workspaceDir || managedSkillsDir) && (
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            {workspaceDir && (
              <div className="flex items-center gap-1.5">
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Workspace: {workspaceDir}</span>
              </div>
            )}
            {managedSkillsDir && (
              <div className="flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" />
                <span>Managed: {managedSkillsDir}</span>
              </div>
            )}
          </div>
        )}

        {/* Skill grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-3 w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredSkills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Puzzle className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-sm">
              {search || filter !== "all"
                ? "No skills match your filters."
                : "No skills registered."}
            </p>
            {(search || filter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSkills.map((skill) => {
              const status = classifySkill(skill);
              const missingItems = getMissingList(skill);
              const requirementItems = getRequirementsList(skill);
              const isExpanded = expandedCards[skill.skillKey] ?? false;
              const isInstalling = installing[skill.skillKey] ?? false;
              const canInstall =
                skill.install &&
                skill.install.length > 0 &&
                (status === "missing" || status === "disabled");

              return (
                <Card
                  key={skill.skillKey}
                  className={`transition-all hover:shadow-md ${
                    status === "blocked"
                      ? "border-orange-500/30 bg-orange-500/5"
                      : status === "missing"
                      ? "border-red-500/20 bg-red-500/5"
                      : status === "disabled"
                      ? "opacity-70"
                      : ""
                  }`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start gap-3">
                      {/* Skill emoji/icon */}
                      <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 text-lg">
                        {skill.emoji ? (
                          <span>{skill.emoji}</span>
                        ) : (
                          <Puzzle className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base flex items-center gap-2">
                          <span className="truncate">{skill.name}</span>
                        </CardTitle>
                        {skill.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {skill.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {/* Badge row */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Status badge */}
                      {status === "ready" && (
                        <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" />
                          Ready
                        </Badge>
                      )}
                      {status === "disabled" && (
                        <Badge variant="secondary">
                          <XCircle className="w-3 h-3" />
                          Disabled
                        </Badge>
                      )}
                      {status === "missing" && (
                        <Badge className="bg-red-500/10 text-red-400 border border-red-500/20">
                          <AlertTriangle className="w-3 h-3" />
                          Missing Deps
                        </Badge>
                      )}
                      {status === "blocked" && (
                        <Badge className="bg-orange-500/10 text-orange-400 border border-orange-500/20">
                          <ShieldAlert className="w-3 h-3" />
                          Blocked
                        </Badge>
                      )}

                      {/* Security badge */}
                      {skill.bundled ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              <ShieldCheck className="w-3 h-3" />
                              Bundled
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            Built-in skill, safe and verified
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge className="bg-purple-500/10 text-purple-400 border border-purple-500/20">
                              <Users className="w-3 h-3" />
                              Community
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            Community-contributed skill
                          </TooltipContent>
                        </Tooltip>
                      )}

                      {/* Allowlist blocked warning */}
                      {skill.blockedByAllowlist && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge className="bg-orange-500/10 text-orange-400 border border-orange-500/20">
                              <ShieldAlert className="w-3 h-3" />
                              Allowlist
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            Blocked by skill allowlist policy
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>

                    {/* Source / path info */}
                    {skill.source && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{skill.source}</span>
                      </div>
                    )}

                    {/* Missing requirements (always visible if present) */}
                    {missingItems.length > 0 && (
                      <div className="rounded-md bg-red-500/10 border border-red-500/20 p-2.5 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-red-400">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Missing Requirements
                        </div>
                        {missingItems.map((item, i) => (
                          <div
                            key={i}
                            className="text-xs text-red-400/80 font-mono pl-5"
                          >
                            {item}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Expandable details section */}
                    {(requirementItems.length > 0 || skill.filePath || skill.baseDir) && (
                      <div>
                        <button
                          onClick={() => toggleExpanded(skill.skillKey)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                          {isExpanded ? "Less details" : "More details"}
                        </button>

                        {isExpanded && (
                          <div className="mt-2 space-y-2 text-xs">
                            {/* Full requirements */}
                            {requirementItems.length > 0 && (
                              <div className="space-y-1">
                                <span className="text-muted-foreground font-medium flex items-center gap-1">
                                  <Terminal className="w-3.5 h-3.5" />
                                  Requirements
                                </span>
                                {requirementItems.map((item, i) => (
                                  <div
                                    key={i}
                                    className="text-muted-foreground font-mono pl-5"
                                  >
                                    {item}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* File path */}
                            {skill.filePath && (
                              <div className="flex items-start gap-1.5 text-muted-foreground">
                                <FolderOpen className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                <span className="font-mono break-all">
                                  {skill.filePath}
                                </span>
                              </div>
                            )}

                            {/* Base dir */}
                            {skill.baseDir && skill.baseDir !== skill.filePath && (
                              <div className="flex items-start gap-1.5 text-muted-foreground">
                                <Package className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                <span className="font-mono break-all">
                                  {skill.baseDir}
                                </span>
                              </div>
                            )}

                            {/* Skill key */}
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Info className="w-3.5 h-3.5 shrink-0" />
                              <span className="font-mono">{skill.skillKey}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Install entries */}
                    {skill.install && skill.install.length > 0 && (
                      <div className="space-y-1.5">
                        {skill.install.map((inst, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between gap-2"
                          >
                            <span className="text-xs text-muted-foreground truncate">
                              {inst.label || inst.kind}
                              {inst.bins?.length
                                ? ` (${inst.bins.join(", ")})`
                                : ""}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (skill.install && skill.install.length > 0) {
                                  setInstallConfirm(skill);
                                }
                              }}
                              disabled={isInstalling}
                              className="shrink-0"
                            >
                              {isInstalling ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Download className="w-3.5 h-3.5" />
                              )}
                              {isInstalling ? "Installing..." : "Install"}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Install Confirmation Dialog */}
        <Dialog
          open={!!installConfirm}
          onOpenChange={(open: boolean) => !open && setInstallConfirm(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Install Skill</DialogTitle>
              <DialogDescription>
                Are you sure you want to install &quot;{installConfirm?.name}
                &quot;?
                {installConfirm && !installConfirm.bundled && (
                  <span className="block mt-2 text-orange-400">
                    This is a community skill. Review the source before
                    installing.
                  </span>
                )}
                {installConfirm?.install?.[0] && (
                  <span className="block mt-2 font-mono text-xs">
                    Method: {installConfirm.install[0].label || installConfirm.install[0].kind}
                    {installConfirm.install[0].bins?.length
                      ? ` -- installs: ${installConfirm.install[0].bins.join(", ")}`
                      : ""}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setInstallConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => installConfirm && handleInstall(installConfirm)}
                disabled={
                  !installConfirm ||
                  installing[installConfirm?.skillKey ?? ""]
                }
              >
                {installing[installConfirm?.skillKey ?? ""] ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Install
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

// ─── Stat Card sub-component ─────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color = "text-foreground",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
