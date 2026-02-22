"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Bot,
  Plus,
  Star,
  Trash2,
  Search,
  MessageSquare,
  FileText,
  Clock,
  Activity,
  Pencil,
  ChevronRight,
  Users,
  Hash,
  Palette,
  Zap,
  FolderOpen,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import type {
  AgentSummary,
  AgentsListResult,
  SessionSummary,
  AgentIdentity,
} from "@/lib/types";

// ─── Types ───────────────────────────────────────────────────────────────────

type AgentSessionData = {
  sessions: SessionSummary[];
  count: number;
};

type AgentDetailData = {
  identity: AgentIdentity | null;
  sessions: AgentSessionData | null;
  files: string[];
  loading: boolean;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(ts?: number): string {
  if (!ts) return "Never";
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(ts).toLocaleDateString();
}

function getActivityStatus(
  sessions: SessionSummary[]
): "active" | "recent" | "idle" {
  if (sessions.length === 0) return "idle";
  const latest = sessions.reduce(
    (max, s) => Math.max(max, s.updatedAt ?? 0),
    0
  );
  if (!latest) return "idle";
  const diff = Date.now() - latest;
  if (diff < 300_000) return "active"; // 5 min
  if (diff < 3_600_000) return "recent"; // 1 hour
  return "idle";
}

const statusColors = {
  active: "bg-emerald-500",
  recent: "bg-amber-500",
  idle: "bg-zinc-400",
};

const statusLabels = {
  active: "Active",
  recent: "Recent",
  idle: "Idle",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function AgentsPage() {

  // Core state
  const [data, setData] = useState<AgentsListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Per-agent session counts (fetched in parallel for all agents)
  const [sessionCounts, setSessionCounts] = useState<
    Record<string, AgentSessionData>
  >({});
  const [sessionCountsLoading, setSessionCountsLoading] = useState(false);

  // Detail sheet state
  const [selectedAgent, setSelectedAgent] = useState<AgentSummary | null>(null);
  const [detailData, setDetailData] = useState<AgentDetailData>({
    identity: null,
    sessions: null,
    files: [],
    loading: false,
  });

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("");
  const [creating, setCreating] = useState(false);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<AgentSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Edit identity dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [editTheme, setEditTheme] = useState("");
  const [saving, setSaving] = useState(false);

  // ─── Fetch agents list ─────────────────────────────────────────────────

  const fetchAgents = useCallback(async () => {
    try {
      const result = await api.rpc("agents.list");
      setData(result);
      return result;
    } catch {
      toast.error("Failed to load agents");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Fetch session counts for all agents ───────────────────────────────

  const fetchSessionCounts = useCallback(
    async (agents: AgentSummary[]) => {
      if (agents.length === 0) return;
      setSessionCountsLoading(true);
      try {
        const results = await Promise.allSettled(
          agents.map(async (agent) => {
            const res = await api.rpc("sessions.list", {
              agentId: agent.id,
              limit: 5,
            });
            return {
              agentId: agent.id,
              sessions: res.sessions ?? [],
              count: res.count ?? 0,
            };
          })
        );
        const counts: Record<string, AgentSessionData> = {};
        for (const result of results) {
          if (result.status === "fulfilled") {
            counts[result.value.agentId] = {
              sessions: result.value.sessions,
              count: result.value.count,
            };
          }
        }
        setSessionCounts(counts);
      } catch {
        // Silently fail for session counts
      } finally {
        setSessionCountsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchAgents().then((result) => {
      if (result?.agents) {
        fetchSessionCounts(result.agents);
      }
    });
  }, [fetchAgents, fetchSessionCounts]);

  // ─── Fetch agent detail when selected ──────────────────────────────────

  const fetchAgentDetail = useCallback(
    async (agent: AgentSummary) => {
      setDetailData({ identity: null, sessions: null, files: [], loading: true });

      const [identityResult, sessionsResult, filesResult] =
        await Promise.allSettled([
          api.rpc("agents.update", { id: agent.id }).catch(() => null),
          api.rpc("sessions.list", { agentId: agent.id, limit: 10 }),
          api.rpc("agents.files.list", { agentId: agent.id }),
        ]);

      setDetailData({
        identity:
          identityResult.status === "fulfilled"
            ? (identityResult.value as AgentSummary | null)?.identity ?? agent.identity ?? null
            : agent.identity ?? null,
        sessions:
          sessionsResult.status === "fulfilled"
            ? {
                sessions: sessionsResult.value.sessions ?? [],
                count: sessionsResult.value.count ?? 0,
              }
            : null,
        files:
          filesResult.status === "fulfilled"
            ? filesResult.value.files ?? []
            : [],
        loading: false,
      });
    },
    []
  );

  useEffect(() => {
    if (selectedAgent) {
      fetchAgentDetail(selectedAgent);
    }
  }, [selectedAgent, fetchAgentDetail]);

  // ─── Search / filter ───────────────────────────────────────────────────

  const filteredAgents = useMemo(() => {
    if (!data?.agents) return [];
    if (!searchQuery.trim()) return data.agents;
    const q = searchQuery.toLowerCase();
    return data.agents.filter(
      (a) =>
        a.id.toLowerCase().includes(q) ||
        (a.name ?? "").toLowerCase().includes(q) ||
        (a.identity?.name ?? "").toLowerCase().includes(q)
    );
  }, [data?.agents, searchQuery]);

  // ─── Handlers ──────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api.rpc("agents.create", {
        id: newName.toLowerCase().replace(/\s+/g, "-"),
        name: newName.trim(),
        identity: {
          name: newName.trim(),
          emoji: newEmoji || undefined,
        },
      });
      toast.success(`Agent "${newName}" created`);
      setCreateOpen(false);
      setNewName("");
      setNewEmoji("");
      const result = await fetchAgents();
      if (result?.agents) fetchSessionCounts(result.agents);
    } catch {
      toast.error("Failed to create agent");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.rpc("agents.delete", { id: deleteTarget.id });
      toast.success(
        `Agent "${deleteTarget.name || deleteTarget.id}" deleted`
      );
      setDeleteTarget(null);
      if (selectedAgent?.id === deleteTarget.id) setSelectedAgent(null);
      const result = await fetchAgents();
      if (result?.agents) fetchSessionCounts(result.agents);
    } catch {
      toast.error("Failed to delete agent");
    } finally {
      setDeleting(false);
    }
  };

  const handleEditIdentity = async () => {
    if (!selectedAgent) return;
    setSaving(true);
    try {
      await api.rpc("agents.update", {
        id: selectedAgent.id,
        identity: {
          name: editName.trim() || undefined,
          emoji: editEmoji || undefined,
          theme: editTheme.trim() || undefined,
        },
      });
      toast.success("Identity updated");
      setEditOpen(false);
      // Refresh
      const result = await fetchAgents();
      if (result?.agents) {
        fetchSessionCounts(result.agents);
        const updated = result.agents.find((a) => a.id === selectedAgent.id);
        if (updated) {
          setSelectedAgent(updated);
          fetchAgentDetail(updated);
        }
      }
    } catch {
      toast.error("Failed to update identity");
    } finally {
      setSaving(false);
    }
  };

  const openEditIdentity = () => {
    if (!selectedAgent) return;
    setEditName(selectedAgent.identity?.name ?? selectedAgent.name ?? "");
    setEditEmoji(selectedAgent.identity?.emoji ?? "");
    setEditTheme(selectedAgent.identity?.theme ?? "");
    setEditOpen(true);
  };

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">Agents</h1>
              {data && (
                <Badge variant="secondary">
                  <Users className="w-3 h-3" />
                  {data.agents.length}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Manage your AI agents
              {data?.defaultId && (
                <span className="text-muted-foreground/60">
                  {" "}
                  &middot; Default:{" "}
                  <span className="font-mono text-xs">{data.defaultId}</span>
                </span>
              )}
            </p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" />
          New Agent
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search agents..."
          className="pl-9"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Agent Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Bot className="w-16 h-16 mb-4 opacity-20" />
          {searchQuery ? (
            <>
              <p className="text-sm font-medium">No agents match your search</p>
              <p className="text-xs mt-1">
                Try a different search term or{" "}
                <button
                  className="text-primary underline"
                  onClick={() => setSearchQuery("")}
                >
                  clear the filter
                </button>
              </p>
            </>
          ) : (
            <>
              <p className="text-sm">No agents found. Create one to get started.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="w-4 h-4" />
                Create Agent
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAgents.map((agent) => {
            const isDefault = agent.id === data?.defaultId;
            const agentSessions = sessionCounts[agent.id];
            const status = agentSessions
              ? getActivityStatus(agentSessions.sessions)
              : "idle";
            const lastSession = agentSessions?.sessions?.[0];
            const lastActivity = lastSession?.updatedAt;

            return (
              <Card
                key={agent.id}
                className={`cursor-pointer transition-all hover:bg-accent/50 hover:shadow-md ${
                  isDefault
                    ? "ring-1 ring-primary/30 border-primary/20"
                    : ""
                } ${
                  selectedAgent?.id === agent.id
                    ? "ring-2 ring-primary"
                    : ""
                }`}
                onClick={() => setSelectedAgent(agent)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-3">
                    {/* Agent Avatar */}
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg shrink-0">
                        {agent.identity?.emoji ? (
                          agent.identity.emoji
                        ) : (
                          <Bot className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      {/* Status dot */}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${statusColors[status]}`}
                        title={statusLabels[status]}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold">
                          {agent.identity?.name || agent.name || agent.id}
                        </span>
                        {isDefault && (
                          <Badge
                            variant="secondary"
                            className="shrink-0 text-[10px] px-1.5 py-0"
                          >
                            <Star className="w-2.5 h-2.5" />
                            Default
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                        {agent.id}
                      </p>
                    </div>

                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <Separator className="mb-3" />
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {sessionCountsLoading ? (
                        <Skeleton className="h-3 w-6 inline-block" />
                      ) : (
                        <span>
                          {agentSessions?.count ?? 0}{" "}
                          {agentSessions?.count === 1
                            ? "session"
                            : "sessions"}
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatRelativeTime(lastActivity)}
                    </span>
                    <span
                      className={`ml-auto flex items-center gap-1 ${
                        status === "active"
                          ? "text-emerald-500"
                          : status === "recent"
                          ? "text-amber-500"
                          : ""
                      }`}
                    >
                      <Activity className="w-3 h-3" />
                      {statusLabels[status]}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Agent Detail Sheet */}
      <Sheet
        open={!!selectedAgent}
        onOpenChange={(open: boolean) => !open && setSelectedAgent(null)}
      >
        <SheetContent className="w-full sm:max-w-lg overflow-hidden flex flex-col">
          <SheetHeader className="pb-0">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-2xl shrink-0">
                {selectedAgent?.identity?.emoji ? (
                  selectedAgent.identity.emoji
                ) : (
                  <Bot className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-lg truncate">
                  {selectedAgent?.identity?.name ||
                    selectedAgent?.name ||
                    selectedAgent?.id}
                </SheetTitle>
                <SheetDescription className="font-mono text-xs truncate">
                  {selectedAgent?.id}
                </SheetDescription>
              </div>
              {selectedAgent?.id === data?.defaultId && (
                <Badge variant="secondary" className="shrink-0">
                  <Star className="w-3 h-3" />
                  Default
                </Badge>
              )}
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1 -mx-4">
            <div className="px-4">
              {detailData.loading ? (
                <div className="space-y-6 py-4">
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-32 w-full" />
                  </div>
                </div>
              ) : (
                <Tabs defaultValue="identity" className="mt-4">
                  <TabsList className="w-full">
                    <TabsTrigger value="identity">
                      <Hash className="w-3.5 h-3.5" />
                      Identity
                    </TabsTrigger>
                    <TabsTrigger value="sessions">
                      <MessageSquare className="w-3.5 h-3.5" />
                      Sessions
                    </TabsTrigger>
                    <TabsTrigger value="files">
                      <FileText className="w-3.5 h-3.5" />
                      Files
                    </TabsTrigger>
                  </TabsList>

                  {/* ── Identity Tab ── */}
                  <TabsContent value="identity" className="space-y-4 py-4">
                    <div className="rounded-lg border bg-card p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium">Agent Identity</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={openEditIdentity}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </Button>
                      </div>
                      <Separator />
                      <div className="grid gap-3">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground flex items-center gap-2">
                            <Hash className="w-3.5 h-3.5" />
                            ID
                          </span>
                          <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
                            {selectedAgent?.id}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground flex items-center gap-2">
                            <Bot className="w-3.5 h-3.5" />
                            Name
                          </span>
                          <span>
                            {detailData.identity?.name ||
                              selectedAgent?.identity?.name ||
                              selectedAgent?.name ||
                              "Unnamed"}
                          </span>
                        </div>
                        {(detailData.identity?.emoji ||
                          selectedAgent?.identity?.emoji) && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground flex items-center gap-2">
                              <Zap className="w-3.5 h-3.5" />
                              Emoji
                            </span>
                            <span className="text-lg">
                              {detailData.identity?.emoji ||
                                selectedAgent?.identity?.emoji}
                            </span>
                          </div>
                        )}
                        {(detailData.identity?.theme ||
                          selectedAgent?.identity?.theme) && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground flex items-center gap-2">
                              <Palette className="w-3.5 h-3.5" />
                              Theme
                            </span>
                            <span>
                              {detailData.identity?.theme ||
                                selectedAgent?.identity?.theme}
                            </span>
                          </div>
                        )}
                        {selectedAgent?.id === data?.defaultId && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground flex items-center gap-2">
                              <Star className="w-3.5 h-3.5" />
                              Role
                            </span>
                            <Badge variant="secondary">Default Agent</Badge>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick stats */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border bg-card p-3 text-center">
                        <p className="text-2xl font-bold">
                          {detailData.sessions?.count ?? 0}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Total Sessions
                        </p>
                      </div>
                      <div className="rounded-lg border bg-card p-3 text-center">
                        <p className="text-2xl font-bold">
                          {detailData.files.length}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Agent Files
                        </p>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="rounded-lg border bg-card p-4 space-y-3">
                      <h3 className="text-sm font-medium">Quick Actions</h3>
                      <Separator />
                      <div className="grid gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="justify-start"
                          onClick={openEditIdentity}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit Identity
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="justify-start"
                          asChild
                        >
                          <a href={`/chat?agent=${selectedAgent?.id}`}>
                            <ExternalLink className="w-3.5 h-3.5" />
                            Open Chat
                          </a>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="justify-start"
                          asChild
                        >
                          <a href={`/sessions?agent=${selectedAgent?.id}`}>
                            <MessageSquare className="w-3.5 h-3.5" />
                            View All Sessions
                          </a>
                        </Button>
                        {selectedAgent?.id !== data?.defaultId && (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="justify-start"
                            onClick={() => {
                              if (selectedAgent) {
                                setDeleteTarget(selectedAgent);
                              }
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete Agent
                          </Button>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  {/* ── Sessions Tab ── */}
                  <TabsContent value="sessions" className="py-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium">
                          Recent Sessions
                          {detailData.sessions && (
                            <span className="text-muted-foreground font-normal ml-2">
                              ({detailData.sessions.count} total)
                            </span>
                          )}
                        </h3>
                      </div>

                      {!detailData.sessions ||
                      detailData.sessions.sessions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No sessions yet</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {detailData.sessions.sessions.map((session) => (
                            <div
                              key={session.key}
                              className="rounded-lg border bg-card p-3 hover:bg-accent/50 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium truncate">
                                    {session.displayName || session.key}
                                  </p>
                                  <p className="text-xs font-mono text-muted-foreground truncate mt-0.5">
                                    {session.key}
                                  </p>
                                </div>
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {formatRelativeTime(session.updatedAt)}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                {session.model && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0"
                                  >
                                    {session.model}
                                  </Badge>
                                )}
                                {session.origin?.surface && (
                                  <span>{session.origin.surface}</span>
                                )}
                                {session.totalTokens != null &&
                                  session.totalTokens > 0 && (
                                    <span>
                                      {session.totalTokens.toLocaleString()}{" "}
                                      tokens
                                    </span>
                                  )}
                              </div>
                            </div>
                          ))}
                          {detailData.sessions.count >
                            detailData.sessions.sessions.length && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full text-muted-foreground"
                              asChild
                            >
                              <a
                                href={`/sessions?agent=${selectedAgent?.id}`}
                              >
                                View all {detailData.sessions.count} sessions
                              </a>
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* ── Files Tab ── */}
                  <TabsContent value="files" className="py-4">
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium">
                        Agent Files
                        <span className="text-muted-foreground font-normal ml-2">
                          ({detailData.files.length})
                        </span>
                      </h3>

                      {detailData.files.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No agent files</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {detailData.files.map((file) => (
                            <div
                              key={file}
                              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent/50 transition-colors"
                            >
                              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                              <span className="font-mono text-xs truncate">
                                {file}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Create Agent Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Agent</DialogTitle>
            <DialogDescription>
              Add a new AI agent to your gateway.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="agent-name">Name</Label>
              <Input
                id="agent-name"
                placeholder="My Agent"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <p className="text-xs text-muted-foreground">
                ID will be:{" "}
                <span className="font-mono">
                  {newName.toLowerCase().replace(/\s+/g, "-") || "..."}
                </span>
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-emoji">Emoji (optional)</Label>
              <Input
                id="agent-emoji"
                placeholder="e.g. 🤖"
                value={newEmoji}
                onChange={(e) => setNewEmoji(e.target.value)}
                maxLength={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
            >
              {creating ? "Creating..." : "Create Agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Identity Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Agent Identity</DialogTitle>
            <DialogDescription>
              Update the identity for{" "}
              <span className="font-mono">{selectedAgent?.id}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                placeholder="Agent name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-emoji">Emoji</Label>
              <Input
                id="edit-emoji"
                placeholder="e.g. 🤖"
                value={editEmoji}
                onChange={(e) => setEditEmoji(e.target.value)}
                maxLength={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-theme">Theme</Label>
              <Input
                id="edit-theme"
                placeholder="e.g. dark, light, ocean"
                value={editTheme}
                onChange={(e) => setEditTheme(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditIdentity} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Agent</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;
              {deleteTarget?.identity?.name ||
                deleteTarget?.name ||
                deleteTarget?.id}
              &quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
