"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGatewaySSEStore } from "@/stores/gateway-sse";
import { api } from "@/lib/api-client";
import { usePinnedSessions } from "@/hooks/use-pinned-sessions";
import type { SessionSummary } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquarePlus,
  Search,
  MessageCircle,
  RefreshCw,
  Bot,
  ChevronDown,
  ChevronRight,
  Pin,
  PinOff,
  Pencil,
  Trash2,
  FileDown,
  Minimize2,
} from "lucide-react";
import { toast } from "sonner";
import { listStaggerContainer, listStaggerItem } from "@/lib/animations";

/* ── Channel helpers ───────────────────────────────────────────────────── */

const CHANNEL_FILTERS = ["All", "Telegram", "WhatsApp", "Discord", "Slack", "Web", "Cron"] as const;
type ChannelFilter = (typeof CHANNEL_FILTERS)[number];

function channelBadge(channel?: string): string | null {
  if (!channel) return null;
  const ch = channel.toLowerCase();
  if (ch.includes("telegram")) return "TG";
  if (ch.includes("whatsapp")) return "WA";
  if (ch.includes("discord")) return "DC";
  if (ch.includes("slack")) return "SL";
  if (ch.includes("webchat") || ch.includes("web")) return "WEB";
  if (ch.includes("cron")) return "CR";
  return ch.slice(0, 2).toUpperCase();
}

function channelColor(channel?: string): string {
  if (!channel) return "bg-primary/10 text-primary";
  const ch = channel.toLowerCase();
  if (ch.includes("telegram")) return "bg-blue-500/15 text-blue-500";
  if (ch.includes("whatsapp")) return "bg-green-500/15 text-green-500";
  if (ch.includes("discord")) return "bg-indigo-500/15 text-indigo-500";
  if (ch.includes("slack")) return "bg-purple-500/15 text-purple-500";
  if (ch.includes("webchat") || ch.includes("web")) return "bg-orange-500/15 text-orange-500";
  if (ch.includes("cron")) return "bg-yellow-500/15 text-yellow-600";
  return "bg-primary/10 text-primary";
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

/* ── Session grouping ─────────────────────────────────────────────────── */

const MY_CHATS_PREFIX = "webchat:fcdash:";
function isMyChat(session: SessionSummary): boolean {
  return session.key.startsWith(MY_CHATS_PREFIX);
}

/* ── Time formatting ──────────────────────────────────────────────────── */

function formatRelativeTime(ts?: number): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  const days = Math.floor(diff / 86_400_000);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* ── Auto title ───────────────────────────────────────────────────────── */

function deriveTitle(session: SessionSummary): string {
  if (session.displayName && session.displayName !== session.key) return session.displayName;
  const lastPart = session.key.split(":").pop() ?? session.key;
  if (lastPart.length > 20) return lastPart.slice(0, 18) + "...";
  return lastPart;
}

/* ── Last message preview ────────────────────────────────────────────── */

function truncatePreview(text?: string): string {
  if (!text) return "";
  const cleaned = text.replace(/\n/g, " ").trim();
  if (cleaned.length > 60) return cleaned.slice(0, 58) + "...";
  return cleaned;
}

/* ── Context menu ─────────────────────────────────────────────────────── */

interface ContextMenuState {
  x: number;
  y: number;
  sessionKey: string;
}

function SessionContextMenu({
  state,
  onClose,
  onPin,
  onRename,
  onDelete,
  onExport,
  onCompact,
  isPinned,
}: {
  state: ContextMenuState;
  onClose: () => void;
  onPin: () => void;
  onRename: () => void;
  onDelete: () => void;
  onExport: () => void;
  onCompact: () => void;
  isPinned: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.1 }}
      className="fixed z-50 w-48 rounded-lg border border-border bg-popover shadow-lg py-1"
      style={{ left: state.x, top: state.y }}
    >
      <button onClick={onPin} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors text-left">
        {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
        {isPinned ? "Unpin session" : "Pin session"}
      </button>
      <button onClick={onRename} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors text-left">
        <Pencil className="w-3.5 h-3.5" />
        Rename session
      </button>
      <button onClick={onExport} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors text-left">
        <FileDown className="w-3.5 h-3.5" />
        Export session
      </button>
      <button onClick={onCompact} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors text-left">
        <Minimize2 className="w-3.5 h-3.5" />
        Compact session
      </button>
      <div className="border-t border-border my-1" />
      <button onClick={onDelete} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 transition-colors text-left">
        <Trash2 className="w-3.5 h-3.5" />
        Delete session
      </button>
    </motion.div>
  );
}

/* ── Rename dialog ────────────────────────────────────────────────────── */

function RenameDialog({
  sessionKey,
  currentName,
  onClose,
  onConfirm,
}: {
  sessionKey: string;
  currentName: string;
  onClose: () => void;
  onConfirm: (name: string) => void;
}) {
  const [value, setValue] = useState(currentName);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="bg-card border border-border rounded-xl shadow-2xl w-80 p-4"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold mb-3">Rename Session</h3>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Session name..."
          className="mb-3"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") { onConfirm(value); onClose(); }
            if (e.key === "Escape") onClose();
          }}
        />
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => { onConfirm(value); onClose(); }}>Save</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Delete dialog ────────────────────────────────────────────────────── */

function DeleteDialog({
  sessionKey,
  onClose,
  onConfirm,
}: {
  sessionKey: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="bg-card border border-border rounded-xl shadow-2xl w-80 p-4"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold mb-2">Delete Session</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Are you sure you want to delete this session? This action cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" size="sm" onClick={() => { onConfirm(); onClose(); }}>Delete</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Session row ──────────────────────────────────────────────────────── */

interface SessionRowProps {
  session: SessionSummary;
  isActive: boolean;
  isPinned: boolean;
  hasUnread?: boolean;
  lastMessage?: string;
  onSelect: (key: string) => void;
  onContextMenu: (e: React.MouseEvent, key: string) => void;
}

function SessionRow({ session, isActive, isPinned, hasUnread, lastMessage, onSelect, onContextMenu }: SessionRowProps) {
  const ch = channelBadge(session.channel);
  const colorCls = channelColor(session.channel);
  const title = deriveTitle(session);
  const preview = truncatePreview(lastMessage);

  return (
    <motion.button
      variants={listStaggerItem}
      onClick={() => onSelect(session.key)}
      onContextMenu={(e: React.MouseEvent) => { e.preventDefault(); onContextMenu(e, session.key); }}
      className={`w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-colors hover:bg-accent/50 ${
        isActive
          ? "bg-accent border-l-2 border-l-primary"
          : "border-l-2 border-l-transparent"
      }`}
    >
      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 ${colorCls}`}>
        {ch || <MessageCircle className="w-3.5 h-3.5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium truncate flex items-center gap-1">
            {isPinned && <Pin className="w-2.5 h-2.5 text-primary shrink-0" />}
            {title}
            {hasUnread && (
              <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
            )}
          </span>
          <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
            {formatRelativeTime(session.updatedAt)}
          </span>
        </div>
        {/* Last message preview */}
        {preview && (
          <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5">{preview}</p>
        )}
        <div className="flex items-center gap-1 mt-0.5">
          {session.agentId && (
            <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">{session.agentId}</Badge>
          )}
          {session.channel && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{session.channel}</Badge>
          )}
        </div>
      </div>
    </motion.button>
  );
}

/* ── Section header ───────────────────────────────────────────────────── */

function SectionHeader({ label, count, expanded, onToggle }: {
  label: string; count: number; expanded: boolean; onToggle: () => void;
}) {
  return (
    <button onClick={onToggle} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-left hover:bg-accent/30 transition-colors group">
      <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.15 }}>
        <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
      </motion.div>
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex-1">{label}</span>
      <span className="text-[10px] font-medium bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 min-w-[18px] text-center tabular-nums">{count}</span>
    </button>
  );
}

/* ── Component ────────────────────────────────────────────────────────── */

interface SessionListProps {
  activeKey: string | null;
  onSelect: (key: string) => void;
  onNewChat: () => void;
}

export function SessionList({ activeKey, onSelect, onNewChat }: SessionListProps) {
  const isConnected = useGatewaySSEStore((s) => s.gatewayConnected);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const [channelFilters, setChannelFilters] = useState<Set<ChannelFilter>>(new Set());
  const [agentFilter, setAgentFilter] = useState<string>("__all__");
  const [groupByAgent, setGroupByAgent] = useState(false);

  const [myChatsExpanded, setMyChatsExpanded] = useState(true);
  const [otherExpanded, setOtherExpanded] = useState(true);
  const [pinnedExpanded, setPinnedExpanded] = useState(true);

  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ key: string; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { isPinned, togglePin, pinned } = usePinnedSessions();

  const loadSessions = useCallback(async () => {
    if (!isConnected) return;
    setLoading(true);
    try {
      const result = await api.rpc("sessions.list", { limit: 100, includeLastMessage: true, includeDerivedTitles: true });
      setSessions(result?.sessions ?? []);
    } catch { /* */ }
    setLoading(false);
  }, [isConnected]);

  useEffect(() => {
    if (isConnected) loadSessions();
  }, [isConnected, loadSessions]);

  const agentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of sessions) { if (s.agentId) ids.add(s.agentId); }
    return Array.from(ids).sort();
  }, [sessions]);

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

  const applyFilters = useCallback((list: SessionSummary[]): SessionSummary[] => {
    return list.filter((s) => {
      if (search) {
        const q = search.toLowerCase();
        if (!s.key.toLowerCase().includes(q) && !s.displayName?.toLowerCase().includes(q) && !s.channel?.toLowerCase().includes(q) && !s.agentId?.toLowerCase().includes(q)) return false;
      }
      if (!matchesChannel(s, channelFilters)) return false;
      if (agentFilter !== "__all__" && s.agentId !== agentFilter) return false;
      return true;
    });
  }, [search, channelFilters, agentFilter]);

  const { pinnedSessions, myChats, otherSessions, agentGroups } = useMemo(() => {
    const allSorted = [...sessions].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    const filtered = applyFilters(allSorted);
    const pins = filtered.filter((s) => isPinned(s.key));
    const mine = filtered.filter((s) => isMyChat(s) && !isPinned(s.key));
    const other = filtered.filter((s) => !isMyChat(s) && !isPinned(s.key));

    // Agent-based grouping
    const groups = new Map<string, SessionSummary[]>();
    if (groupByAgent) {
      for (const s of filtered) {
        const agent = s.agentId || "default";
        if (!groups.has(agent)) groups.set(agent, []);
        groups.get(agent)!.push(s);
      }
    }

    return { pinnedSessions: pins, myChats: mine, otherSessions: other, agentGroups: groups };
  }, [sessions, applyFilters, isPinned, pinned, groupByAgent]);

  // Context menu handlers
  const handleContextMenu = useCallback((e: React.MouseEvent, key: string) => {
    setCtxMenu({ x: e.clientX, y: e.clientY, sessionKey: key });
  }, []);

  const handleRename = useCallback(async (key: string, name: string) => {
    try {
      await api.rpc("sessions.patch", { key, label: name });
      toast.success("Session renamed");
      loadSessions();
    } catch {
      toast.error("Failed to rename session");
    }
  }, [loadSessions]);

  const handleDelete = useCallback(async (key: string) => {
    try {
      await api.rpc("sessions.delete", { key });
      toast.success("Session deleted");
      loadSessions();
      if (activeKey === key) onSelect("");
    } catch {
      toast.error("Failed to delete session");
    }
  }, [loadSessions, activeKey, onSelect]);

  const handleExport = useCallback(async (key: string) => {
    try {
      const result = await api.rpc("chat.history", { sessionKey: key, limit: 500 });
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `session-${key.replace(/[^a-z0-9]/gi, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Session exported");
    } catch {
      toast.error("Failed to export session");
    }
  }, []);

  const handleCompact = useCallback(async (key: string) => {
    try {
      await api.rpc("sessions.compact", { key });
      toast.success("Session compacted");
    } catch {
      toast.error("Failed to compact session");
    }
  }, []);

  const hasAnyFilters = search.length > 0 || channelFilters.size > 0 || agentFilter !== "__all__";
  const totalFiltered = pinnedSessions.length + myChats.length + otherSessions.length;

  const renderSessionList = (list: SessionSummary[]) => (
    <motion.div variants={listStaggerContainer} initial="initial" animate="animate">
      {list.map((session) => (
        <SessionRow
          key={session.key}
          session={session}
          isActive={activeKey === session.key}
          isPinned={isPinned(session.key)}
          lastMessage={(session as Record<string, unknown>).lastMessage as string | undefined}
          onSelect={onSelect}
          onContextMenu={handleContextMenu}
        />
      ))}
    </motion.div>
  );

  return (
    <div className="w-72 border-r border-border flex flex-col h-full bg-card/50 shrink-0 max-md:hidden" id="session-sidebar">
      {/* Header */}
      <div className="p-3 border-b border-border space-y-2 shrink-0">
        <div className="flex gap-2">
          <Button onClick={onNewChat} className="flex-1" size="sm" variant="outline">
            <MessageSquarePlus className="w-4 h-4 mr-2" />
            New Chat
          </Button>
          <Button onClick={loadSessions} size="icon-sm" variant="ghost" title="Refresh sessions">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sessions..." className="pl-8 h-8 text-xs" />
        </div>
        <div className="flex flex-wrap gap-1">
          {CHANNEL_FILTERS.map((ch) => {
            const isActive = ch === "All" ? channelFilters.size === 0 : channelFilters.has(ch);
            return (
              <button
                key={ch}
                onClick={() => toggleChannel(ch)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
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
        {agentIds.length > 0 && (
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger size="sm" className="w-full h-7 text-xs">
              <Bot className="w-3 h-3 shrink-0" />
              <SelectValue placeholder="All Agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Agents</SelectItem>
              {agentIds.map((id) => (
                <SelectItem key={id} value={id}>{id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading && sessions.length === 0 ? (
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
        ) : (
          <div className="py-1">
            {/* Pinned section */}
            <AnimatePresence>
              {pinnedSessions.length > 0 && (
                <>
                  <SectionHeader label="Pinned" count={pinnedSessions.length} expanded={pinnedExpanded} onToggle={() => setPinnedExpanded((v) => !v)} />
                  {pinnedExpanded && renderSessionList(pinnedSessions)}
                  <div className="mt-1 border-t border-border/50" />
                </>
              )}
            </AnimatePresence>

            {/* My Chats */}
            <SectionHeader label="My Chats" count={myChats.length} expanded={myChatsExpanded} onToggle={() => setMyChatsExpanded((v) => !v)} />
            <AnimatePresence>
              {myChatsExpanded && (
                myChats.length === 0
                  ? <p className="px-4 py-2 text-[11px] text-muted-foreground italic">{hasAnyFilters ? "No matching sessions" : "No sessions found"}</p>
                  : renderSessionList(myChats)
              )}
            </AnimatePresence>

            <div className="mt-1 border-t border-border/50" />

            {/* Other Channels */}
            <div className="mt-1">
              <SectionHeader label="Other Channels" count={otherSessions.length} expanded={otherExpanded} onToggle={() => setOtherExpanded((v) => !v)} />
              <AnimatePresence>
                {otherExpanded && (
                  otherSessions.length === 0
                    ? <p className="px-4 py-2 text-[11px] text-muted-foreground italic">{hasAnyFilters ? "No matching sessions" : "No sessions found"}</p>
                    : renderSessionList(otherSessions)
                )}
              </AnimatePresence>
            </div>

            {totalFiltered === 0 && !loading && (
              <div className="p-8 text-center text-xs text-muted-foreground">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
                {hasAnyFilters ? "No matching sessions" : "No sessions found"}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Context menu */}
      <AnimatePresence>
        {ctxMenu && (
          <SessionContextMenu
            state={ctxMenu}
            isPinned={isPinned(ctxMenu.sessionKey)}
            onClose={() => setCtxMenu(null)}
            onPin={() => { togglePin(ctxMenu.sessionKey); setCtxMenu(null); }}
            onRename={() => {
              const s = sessions.find((s) => s.key === ctxMenu.sessionKey);
              setRenameTarget({ key: ctxMenu.sessionKey, name: deriveTitle(s!) });
              setCtxMenu(null);
            }}
            onDelete={() => { setDeleteTarget(ctxMenu.sessionKey); setCtxMenu(null); }}
            onExport={() => { handleExport(ctxMenu.sessionKey); setCtxMenu(null); }}
            onCompact={() => { handleCompact(ctxMenu.sessionKey); setCtxMenu(null); }}
          />
        )}
      </AnimatePresence>

      {/* Rename dialog */}
      <AnimatePresence>
        {renameTarget && (
          <RenameDialog
            sessionKey={renameTarget.key}
            currentName={renameTarget.name}
            onClose={() => setRenameTarget(null)}
            onConfirm={(name) => handleRename(renameTarget.key, name)}
          />
        )}
      </AnimatePresence>

      {/* Delete dialog */}
      <AnimatePresence>
        {deleteTarget && (
          <DeleteDialog
            sessionKey={deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onConfirm={() => handleDelete(deleteTarget)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
