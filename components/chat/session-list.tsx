"use client";

import { useEffect, useState, useCallback } from "react";
import { useGatewayStore } from "@/stores/gateway";
import type { SessionSummary } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquarePlus,
  Search,
  MessageCircle,
  RefreshCw,
} from "lucide-react";

function channelBadge(channel?: string): string | null {
  if (!channel) return null;
  const ch = channel.toLowerCase();
  if (ch.includes("telegram")) return "TG";
  if (ch.includes("whatsapp")) return "WA";
  if (ch.includes("discord")) return "DC";
  if (ch.includes("slack")) return "SL";
  if (ch.includes("webchat")) return "WEB";
  return ch.slice(0, 2).toUpperCase();
}

function formatRelativeTime(ts?: number): string {
  if (!ts) return "";
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

interface SessionListProps {
  activeKey: string | null;
  onSelect: (key: string) => void;
  onNewChat: () => void;
}

export function SessionList({
  activeKey,
  onSelect,
  onNewChat,
}: SessionListProps) {
  const rpc = useGatewayStore((s) => s.rpc);
  const isConnected = useGatewayStore((s) => s.state === "connected");
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const loadSessions = useCallback(async () => {
    if (!isConnected) return;
    setLoading(true);
    try {
      const result = await rpc("sessions.list", {
        limit: 100,
        includeLastMessage: true,
        includeDerivedTitles: true,
      });
      if (Array.isArray(result)) {
        setSessions(result);
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [rpc, isConnected]);

  useEffect(() => {
    if (isConnected) loadSessions();
  }, [isConnected, loadSessions]);

  const filtered = sessions.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.key.toLowerCase().includes(q) ||
      s.displayName?.toLowerCase().includes(q) ||
      s.channel?.toLowerCase().includes(q) ||
      s.agentId?.toLowerCase().includes(q)
    );
  });

  // Sort by updatedAt descending (most recent first)
  const sorted = [...filtered].sort(
    (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
  );

  return (
    <div className="w-72 border-r border-border flex flex-col h-full bg-card/50">
      {/* Header with new chat button and search */}
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex gap-2">
          <Button
            onClick={onNewChat}
            className="flex-1"
            size="sm"
            variant="outline"
          >
            <MessageSquarePlus className="w-4 h-4 mr-2" />
            New Chat
          </Button>
          <Button
            onClick={loadSessions}
            size="icon-sm"
            variant="ghost"
            title="Refresh sessions"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sessions..."
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* Session list */}
      <ScrollArea className="flex-1">
        {loading && sorted.length === 0 ? (
          <div className="p-3 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-2.5 px-3">
                <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
            {search ? "No matching sessions" : "No sessions found"}
          </div>
        ) : (
          <div className="py-1">
            {sorted.map((session) => {
              const isActive = activeKey === session.key;
              const ch = channelBadge(session.channel);
              return (
                <button
                  key={session.key}
                  onClick={() => onSelect(session.key)}
                  className={`w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-colors hover:bg-accent/50 ${
                    isActive
                      ? "bg-accent border-l-2 border-l-primary"
                      : "border-l-2 border-l-transparent"
                  }`}
                >
                  {/* Channel avatar */}
                  <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold mt-0.5">
                    {ch || (
                      <MessageCircle className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate">
                        {session.displayName ||
                          session.key.split(":").pop() ||
                          session.key}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                        {formatRelativeTime(session.updatedAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {session.agentId && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1 py-0 h-4"
                        >
                          {session.agentId}
                        </Badge>
                      )}
                      {session.channel && (
                        <span className="text-[10px] text-muted-foreground">
                          {session.channel}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
