"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useGatewayStore } from "@/stores/gateway";
import { useIsConnected } from "@/hooks/use-gateway";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";
import { toast } from "sonner";
import type { SessionSummary } from "@/lib/types";

type DestructiveAction = {
  type: "reset" | "compact" | "delete";
  session: SessionSummary;
};

export default function SessionsPage() {
  const router = useRouter();
  const rpc = useGatewayStore((s) => s.rpc);
  const isConnected = useIsConnected();

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionConfirm, setActionConfirm] = useState<DestructiveAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchSessions = useCallback(async () => {
    if (!isConnected) return;
    try {
      const result = await rpc("sessions.list", { limit: 100, includeDerivedTitles: true });
      setSessions(result);
    } catch {
      toast.error("Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, [isConnected, rpc]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sessions;
    const q = search.toLowerCase();
    return sessions.filter(
      (s) =>
        s.key.toLowerCase().includes(q) ||
        s.displayName?.toLowerCase().includes(q) ||
        s.channel?.toLowerCase().includes(q) ||
        s.agentId?.toLowerCase().includes(q) ||
        s.model?.toLowerCase().includes(q)
    );
  }, [sessions, search]);

  const handleAction = async () => {
    if (!actionConfirm) return;
    setActionLoading(true);
    const { type, session } = actionConfirm;
    try {
      switch (type) {
        case "reset":
          await rpc("sessions.reset", { key: session.key });
          toast.success("Session reset");
          break;
        case "compact":
          await rpc("sessions.compact", { key: session.key });
          toast.success("Session compacted");
          break;
        case "delete":
          await rpc("sessions.delete", { key: session.key });
          toast.success("Session deleted");
          break;
      }
      setActionConfirm(null);
      fetchSessions();
    } catch {
      toast.error(`Failed to ${type} session`);
    } finally {
      setActionLoading(false);
    }
  };

  const formatTime = (ts?: number) => {
    if (!ts) return "--";
    const d = new Date(ts);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTokens = (n?: number) => {
    if (n == null) return "--";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
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
        <h1 className="text-2xl font-bold">Sessions</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage active and recent chat sessions
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search sessions..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Session List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16 ml-auto" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
          <p className="text-sm">
            {search ? "No sessions match your search." : "No sessions found."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((session) => (
            <Card key={session.key} className="hover:bg-accent/30 transition-colors">
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {session.displayName || session.key}
                      </span>
                      {session.channel && (
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {session.channel}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {session.displayName && (
                        <span className="font-mono truncate max-w-[200px]">{session.key}</span>
                      )}
                      {session.agentId && <span>Agent: {session.agentId}</span>}
                      {session.model && <span>Model: {session.model}</span>}
                      {session.totalTokens != null && (
                        <span>Tokens: {formatTokens(session.totalTokens)}</span>
                      )}
                      <span>{formatTime(session.updatedAt)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/chat?session=${encodeURIComponent(session.key)}`)}
                      title="Open Chat"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActionConfirm({ type: "reset", session })}
                      title="Reset"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActionConfirm({ type: "compact", session })}
                      title="Compact"
                    >
                      <Shrink className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActionConfirm({ type: "delete", session })}
                      title="Delete"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={!!actionConfirm} onOpenChange={(open: boolean) => !open && setActionConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">{actionConfirm?.type} Session</DialogTitle>
            <DialogDescription>
              {actionConfirm?.type === "delete"
                ? "This will permanently delete the session and all its messages. This cannot be undone."
                : actionConfirm?.type === "reset"
                ? "This will reset the session, clearing all messages but keeping the session."
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
