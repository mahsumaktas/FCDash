"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useApiQuery } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  MessageSquare,
  Search,
  RotateCcw,
  Shrink,
  Trash2,
  ExternalLink,
  WifiOff,
  ArrowUpDown,
  CheckSquare,
  Square,
  MinusSquare,
  Activity,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import type { SessionSummary } from "@/lib/types";

/* ── Constants ────────────────────────────────────────────────────────── */

const CHANNEL_OPTIONS = [
  "All",
  "Telegram",
  "WhatsApp",
  "Discord",
  "Slack",
  "Web",
  "Cron",
] as const;
type ChannelFilter = (typeof CHANNEL_OPTIONS)[number];

const KIND_OPTIONS = ["all", "direct", "group", "global"] as const;
type KindFilter = (typeof KIND_OPTIONS)[number];

const STATUS_OPTIONS = ["all", "active", "inactive"] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];

const SORT_OPTIONS = [
  { value: "updated", label: "Last Updated" },
  { value: "tokens", label: "Tokens Used" },
  { value: "name", label: "Name" },
] as const;
type SortOption = (typeof SORT_OPTIONS)[number]["value"];

type DestructiveAction = {
  type: "reset" | "compact" | "delete";
  sessions: SessionSummary[];
};

/* ── Helpers ──────────────────────────────────────────────────────────── */

const ACTIVE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

function isSessionActive(s: SessionSummary): boolean {
  if (!s.updatedAt) return false;
  return Date.now() - s.updatedAt < ACTIVE_THRESHOLD_MS;
}

function matchesChannel(session: SessionSummary, filters: Set<ChannelFilter>): boolean {
  if (filters.size === 0 || filters.has("All")) return true;
  const ch = (session.channel ?? "").toLowerCase();
  for (const f of filters) {
    const fl = f.toLowerCase();
    if (ch.includes(fl)) return true;
    if (fl === "web" && ch.includes("webchat")) return true;
  }
  return false;
}

function formatRelativeTime(ts?: number): string {
  if (!ts) return "--";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  const days = Math.floor(diff / 86_400_000);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatTokens(n?: number): string {
  if (n == null) return "--";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function channelColor(channel?: string): string {
  if (!channel) return "border-border";
  const ch = channel.toLowerCase();
  if (ch.includes("telegram")) return "border-blue-500/40";
  if (ch.includes("whatsapp")) return "border-green-500/40";
  if (ch.includes("discord")) return "border-indigo-500/40";
  if (ch.includes("slack")) return "border-purple-500/40";
  if (ch.includes("webchat") || ch.includes("web")) return "border-orange-500/40";
  if (ch.includes("cron")) return "border-yellow-500/40";
  return "border-border";
}

/* ── Page Component ───────────────────────────────────────────────────── */

export default function SessionsPage() {
  const router = useRouter();

  const { data: sessionsData, loading, error, refetch } = useApiQuery({
    method: "sessions.list",
    params: { limit: 100, includeDerivedTitles: true },
    pollInterval: 0,
  });

  const sessions = sessionsData?.sessions ?? [];
  const [search, setSearch] = useState("");

  // Filter state
  const [channelFilters, setChannelFilters] = useState<Set<ChannelFilter>>(new Set());
  const [agentFilter, setAgentFilter] = useState<string>("__all__");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("updated");

  // Selection state
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Action dialog
  const [actionConfirm, setActionConfirm] = useState<DestructiveAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  /* ── Derived data ────────────────────────────────────────────────────── */

  const agentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of sessions) {
      if (s.agentId) ids.add(s.agentId);
    }
    return Array.from(ids).sort();
  }, [sessions]);

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      // Text search
      if (search.trim()) {
        const q = search.toLowerCase();
        const m =
          s.key.toLowerCase().includes(q) ||
          s.displayName?.toLowerCase().includes(q) ||
          s.channel?.toLowerCase().includes(q) ||
          s.agentId?.toLowerCase().includes(q) ||
          s.model?.toLowerCase().includes(q);
        if (!m) return false;
      }
      // Channel
      if (!matchesChannel(s, channelFilters)) return false;
      // Agent
      if (agentFilter !== "__all__" && s.agentId !== agentFilter) return false;
      // Status
      if (statusFilter === "active" && !isSessionActive(s)) return false;
      if (statusFilter === "inactive" && isSessionActive(s)) return false;
      // Kind
      if (kindFilter !== "all") {
        const k = (s.kind ?? "").toLowerCase();
        if (k !== kindFilter) return false;
      }
      return true;
    });
  }, [sessions, search, channelFilters, agentFilter, statusFilter, kindFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortBy) {
      case "updated":
        arr.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
        break;
      case "tokens":
        arr.sort((a, b) => (b.totalTokens ?? 0) - (a.totalTokens ?? 0));
        break;
      case "name":
        arr.sort((a, b) =>
          (a.displayName ?? a.key).localeCompare(b.displayName ?? b.key)
        );
        break;
    }
    return arr;
  }, [filtered, sortBy]);

  /* ── Stats ───────────────────────────────────────────────────────────── */

  const stats = useMemo(() => {
    const total = sessions.length;
    const active = sessions.filter(isSessionActive).length;
    const totalTokens = sessions.reduce((sum, s) => sum + (s.totalTokens ?? 0), 0);
    return { total, active, totalTokens };
  }, [sessions]);

  /* ── Selection helpers ───────────────────────────────────────────────── */

  const toggleSelect = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === sorted.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sorted.map((s) => s.key)));
    }
  };

  const clearSelection = () => setSelected(new Set());

  const selectAllState: "none" | "some" | "all" =
    selected.size === 0 ? "none" : selected.size === sorted.length ? "all" : "some";

  /* ── Channel pill toggle ─────────────────────────────────────────────── */

  const toggleChannel = (ch: ChannelFilter) => {
    setChannelFilters((prev) => {
      const next = new Set(prev);
      if (ch === "All") return new Set();
      next.delete("All");
      if (next.has(ch)) next.delete(ch);
      else next.add(ch);
      return next;
    });
  };

  /* ── Actions ─────────────────────────────────────────────────────────── */

  const handleAction = async () => {
    if (!actionConfirm) return;
    setActionLoading(true);
    const { type, sessions: targets } = actionConfirm;
    let successCount = 0;
    let failCount = 0;

    for (const session of targets) {
      try {
        switch (type) {
          case "reset":
            await api.rpc("sessions.reset", { key: session.key });
            break;
          case "compact":
            await api.rpc("sessions.compact", { key: session.key });
            break;
          case "delete":
            await api.rpc("sessions.delete", { key: session.key });
            break;
        }
        successCount++;
      } catch {
        failCount++;
      }
    }

    if (successCount > 0) {
      toast.success(
        targets.length === 1
          ? `Session ${type === "delete" ? "deleted" : type === "reset" ? "reset" : "compacted"}`
          : `${successCount} session(s) ${type === "delete" ? "deleted" : type === "reset" ? "reset" : "compacted"}`
      );
    }
    if (failCount > 0) {
      toast.error(`Failed to ${type} ${failCount} session(s)`);
    }

    setActionConfirm(null);
    setActionLoading(false);
    setSelected(new Set());
    refetch();
  };

  const bulkAction = (type: "reset" | "compact" | "delete") => {
    const targets = sessions.filter((s) => selected.has(s.key));
    if (targets.length === 0) return;
    setActionConfirm({ type, sessions: targets });
  };

  /* ── Error state ─────────────────────────────────────────────────────── */

  if (error && !sessions.length) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full text-muted-foreground">
        <WifiOff className="w-16 h-16 mb-4 opacity-20" />
        <h2 className="text-lg font-medium mb-1">Unable to Load Sessions</h2>
        <p className="text-sm">{error.message}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={refetch}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold">Sessions</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage active and recent chat sessions
        </p>
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-semibold leading-tight">{stats.total}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2">
          <Activity className="w-4 h-4 text-green-500" />
          <div>
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="text-lg font-semibold leading-tight">{stats.active}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2">
          <Zap className="w-4 h-4 text-yellow-500" />
          <div>
            <p className="text-xs text-muted-foreground">Total Tokens</p>
            <p className="text-lg font-semibold leading-tight">
              {formatTokens(stats.totalTokens)}
            </p>
          </div>
        </div>
      </div>

      {/* Filters row */}
      <div className="space-y-3">
        {/* Search + dropdowns */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search sessions..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Agent filter */}
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger size="sm" className="w-[160px]">
              <SelectValue placeholder="All Agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Agents</SelectItem>
              {agentIds.map((id) => (
                <SelectItem key={id} value={id}>
                  {id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status filter */}
          <Select value={statusFilter} onValueChange={(v: string) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger size="sm" className="w-[130px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt === "all" ? "All Status" : opt.charAt(0).toUpperCase() + opt.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Kind filter */}
          <Select value={kindFilter} onValueChange={(v: string) => setKindFilter(v as KindFilter)}>
            <SelectTrigger size="sm" className="w-[130px]">
              <SelectValue placeholder="All Kinds" />
            </SelectTrigger>
            <SelectContent>
              {KIND_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt === "all" ? "All Kinds" : opt.charAt(0).toUpperCase() + opt.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select value={sortBy} onValueChange={(v: string) => setSortBy(v as SortOption)}>
            <SelectTrigger size="sm" className="w-[160px]">
              <ArrowUpDown className="w-3.5 h-3.5 mr-1" />
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

        {/* Channel pills */}
        <div className="flex flex-wrap gap-1.5">
          {CHANNEL_OPTIONS.map((ch) => {
            const isActive =
              ch === "All" ? channelFilters.size === 0 : channelFilters.has(ch);
            return (
              <button
                key={ch}
                onClick={() => toggleChannel(ch)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {ch}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-1.5 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => bulkAction("reset")}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Reset
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => bulkAction("compact")}
            >
              <Shrink className="w-3.5 h-3.5 mr-1.5" />
              Compact
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => bulkAction("delete")}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Delete
            </Button>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Session List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16 ml-auto" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
          <p className="text-sm">
            {search || channelFilters.size > 0 || agentFilter !== "__all__" || statusFilter !== "all" || kindFilter !== "all"
              ? "No sessions match your filters."
              : "No sessions found."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Select all header */}
          <div className="flex items-center gap-3 px-1 pb-1">
            <button
              onClick={toggleSelectAll}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title={selectAllState === "all" ? "Deselect all" : "Select all"}
            >
              {selectAllState === "all" ? (
                <CheckSquare className="w-4.5 h-4.5" />
              ) : selectAllState === "some" ? (
                <MinusSquare className="w-4.5 h-4.5" />
              ) : (
                <Square className="w-4.5 h-4.5" />
              )}
            </button>
            <span className="text-xs text-muted-foreground">
              {sorted.length} session{sorted.length !== 1 ? "s" : ""}
              {filtered.length !== sessions.length && ` (of ${sessions.length})`}
            </span>
          </div>

          {sorted.map((session) => {
            const active = isSessionActive(session);
            const isSelected = selected.has(session.key);
            const borderColor = channelColor(session.channel);

            return (
              <Card
                key={session.key}
                className={`transition-colors border-l-4 ${borderColor} ${
                  isSelected ? "bg-accent/40 ring-1 ring-primary/20" : "hover:bg-accent/30"
                }`}
              >
                <CardContent className="py-3.5">
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(session.key);
                      }}
                      className="mt-0.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4.5 h-4.5 text-primary" />
                      ) : (
                        <Square className="w-4.5 h-4.5" />
                      )}
                    </button>

                    {/* Active indicator + Info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        {/* Activity dot */}
                        <span
                          className={`shrink-0 w-2 h-2 rounded-full ${
                            active ? "bg-green-500" : "bg-muted-foreground/30"
                          }`}
                          title={active ? "Active (updated within 5 min)" : "Inactive"}
                        />
                        <span className="font-medium text-sm truncate">
                          {session.displayName || session.key}
                        </span>
                        {session.channel && (
                          <Badge variant="outline" className="shrink-0 text-xs">
                            {session.channel}
                          </Badge>
                        )}
                        {session.kind && (
                          <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0 h-4">
                            {session.kind}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {session.displayName && (
                          <span className="font-mono truncate max-w-[200px]">
                            {session.key}
                          </span>
                        )}
                        {session.agentId && <span>Agent: {session.agentId}</span>}
                        {session.model && <span>Model: {session.model}</span>}
                        {session.totalTokens != null && (
                          <span>Tokens: {formatTokens(session.totalTokens)}</span>
                        )}
                        <span>{formatRelativeTime(session.updatedAt)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          router.push(
                            `/chat?session=${encodeURIComponent(session.key)}`
                          )
                        }
                        title="Open Chat"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setActionConfirm({ type: "reset", sessions: [session] })
                        }
                        title="Reset"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setActionConfirm({ type: "compact", sessions: [session] })
                        }
                        title="Compact"
                      >
                        <Shrink className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setActionConfirm({ type: "delete", sessions: [session] })
                        }
                        title="Delete"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog
        open={!!actionConfirm}
        onOpenChange={(open: boolean) => !open && setActionConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">
              {actionConfirm?.type}{" "}
              {actionConfirm && actionConfirm.sessions.length > 1
                ? `${actionConfirm.sessions.length} Sessions`
                : "Session"}
            </DialogTitle>
            <DialogDescription>
              {actionConfirm?.type === "delete"
                ? (actionConfirm.sessions.length ?? 0) > 1
                  ? `This will permanently delete ${actionConfirm.sessions.length} sessions and all their messages. This cannot be undone.`
                  : "This will permanently delete the session and all its messages. This cannot be undone."
                : actionConfirm?.type === "reset"
                ? (actionConfirm?.sessions?.length ?? 0) > 1
                  ? `This will reset ${actionConfirm.sessions.length} sessions, clearing all messages but keeping the sessions.`
                  : "This will reset the session, clearing all messages but keeping the session."
                : (actionConfirm?.sessions?.length ?? 0) > 1
                ? `This will compact ${actionConfirm?.sessions?.length} sessions, reducing token usage by summarizing the conversations.`
                : "This will compact the session, reducing token usage by summarizing the conversation."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant={actionConfirm?.type === "delete" ? "destructive" : "default"}
              onClick={handleAction}
              disabled={actionLoading}
            >
              {actionLoading
                ? "Processing..."
                : actionConfirm?.type === "delete"
                ? "Delete"
                : actionConfirm?.type === "reset"
                ? "Reset"
                : "Compact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
