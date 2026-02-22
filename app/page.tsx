"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useEvent } from "@/hooks/use-event";
import { formatLastUpdated } from "@/hooks/use-realtime-data";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { staggerContainer, staggerItem } from "@/lib/animations";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Heart,
  Clock,
  Tag,
  Bot,
  MessageSquare,
  Radio,
  ShieldCheck,
  ArrowRight,
  ScrollText,
  DollarSign,
  Zap,
  Activity,
  Users,
  RefreshCw,
} from "lucide-react";
import type {
  HealthStatus,
  AgentsListResult,
  ChannelsStatusResult,
  SessionSummary,
} from "@/lib/types";

// ─── Types for usage data ────────────────────────────────────────────────────

type UsageDailyEntry = {
  date: string;
  totalTokens: number;
  totalCost: number;
  input: number;
  output: number;
};

type UsageCostResult = {
  daily: UsageDailyEntry[];
  totals: { totalTokens: number; totalCost: number };
};

// ─── Chart Colors ────────────────────────────────────────────────────────────

const CHART_COLORS = {
  inputTokens: "#8b5cf6",
  outputTokens: "#10b981",
  cost: "#f59e0b",
};

const DONUT_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];

// ─── Animated number counter ─────────────────────────────────────────────────

function AnimatedNumber({ value, prefix = "", suffix = "", decimals = 0 }: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    prevRef.current = value;
    if (from === to) return;

    const duration = 400;
    const start = performance.now();

    function step(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * eased);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, [value]);

  return <>{prefix}{display.toFixed(decimals)}{suffix}</>;
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();

  const [serverInfo, setServerInfo] = useState<{ uptime: number | null; version: string | null }>({ uptime: null, version: null });
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [agents, setAgents] = useState<AgentsListResult | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionCount, setSessionCount] = useState<number>(0);
  const [channels, setChannels] = useState<ChannelsStatusResult | null>(null);
  const [usageCost, setUsageCost] = useState<UsageCostResult | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);

  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [healthRes, agentsRes, sessionsRes, channelsRes, usageRes, infoRes] =
        await Promise.allSettled([
          api.rpc("health"),
          api.rpc("agents.list"),
          api.rpc("sessions.list", { limit: 100, includeDerivedTitles: true }),
          api.rpc("channels.status"),
          api.rpc("usage.cost", { days: 7 }),
          api.health(),
        ]);
      if (healthRes.status === "fulfilled") setHealth(healthRes.value);
      if (agentsRes.status === "fulfilled") setAgents(agentsRes.value);
      if (sessionsRes.status === "fulfilled") {
        setSessions(sessionsRes.value?.sessions ?? []);
        setSessionCount(sessionsRes.value?.count ?? 0);
      }
      if (channelsRes.status === "fulfilled") setChannels(channelsRes.value);
      if (usageRes.status === "fulfilled")
        setUsageCost(usageRes.value as unknown as UsageCostResult);
      if (infoRes.status === "fulfilled")
        setServerInfo({ uptime: infoRes.value.uptime, version: infoRes.value.version });
    } catch {
      // Individual sections handle their own empty states
    } finally {
      setLoading(false);
      setLastRefresh(Date.now());
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 60s (fallback — event-driven refetch handles real-time updates)
  useEffect(() => {
    autoRefreshRef.current = setInterval(() => {
      fetchData();
    }, 60_000);

    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
    };
  }, [fetchData]);

  // Live health updates via events
  useEvent("health", () => {
    api.rpc("health").then(setHealth).catch(() => {});
  });

  // Track pending approvals via events
  useEvent("exec.approval.requested", () => {
    setPendingApprovals((c) => c + 1);
  });
  useEvent("exec.approval.resolved", () => {
    setPendingApprovals((c) => Math.max(0, c - 1));
  });

  // Event-driven: refresh sessions on chat completion
  useEvent("chat" as never, () => {
    api.rpc("sessions.list", { limit: 100, includeDerivedTitles: true })
      .then((res) => {
        setSessions(res?.sessions ?? []);
        setSessionCount(res?.count ?? 0);
      })
      .catch(() => {});
  });

  // ─── Derived values ──────────────────────────────────────────────────────

  const uptimeStr = serverInfo.uptime ? formatUptime(serverInfo.uptime) : "--";
  const version = serverInfo.version ?? "--";
  const isHealthy = health?.ok ?? false;
  const agentCount = agents?.agents?.length ?? 0;
  const defaultAgentId = agents?.defaultId;

  const costToday = useMemo(() => {
    if (!usageCost?.daily?.length) return 0;
    return usageCost.daily[usageCost.daily.length - 1]?.totalCost ?? 0;
  }, [usageCost]);

  const tokenChartData = useMemo(() => {
    if (!usageCost?.daily) return [];
    return usageCost.daily.map((d) => ({
      date: formatShortDate(d.date),
      input: d.input,
      output: d.output,
    }));
  }, [usageCost]);

  const costChartData = useMemo(() => {
    if (!usageCost?.daily) return [];
    return usageCost.daily.map((d) => ({
      date: formatShortDate(d.date),
      cost: d.totalCost,
    }));
  }, [usageCost]);

  const sessionsByChannel = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of sessions) {
      const ch = s.channel || "unknown";
      map[ch] = (map[ch] || 0) + 1;
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [sessions]);

  const channelList = useMemo(() => {
    if (!channels?.channels) return [];
    const order = channels.channelOrder ?? Object.keys(channels.channels);
    const labels = channels.channelLabels ?? {};
    return order.map((id) => ({
      id,
      label: labels[id] || id,
      detail: channels.channels![id],
    }));
  }, [channels]);

  const recentSessions = useMemo(() => {
    return [...sessions]
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
      .slice(0, 8);
  }, [sessions]);

  return (
    <div className="p-6 space-y-6">
      {/* Header with last updated */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            System overview and quick actions
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-[10px] text-muted-foreground/50">
              Updated {formatLastUpdated(lastRefresh)}
            </span>
          )}
          <Button variant="ghost" size="icon-sm" onClick={fetchData} title="Refresh now">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Zone 1: KPI Row with staggered animation ──────────────────────── */}
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4"
      >
        <motion.div variants={staggerItem}>
          <StatusCard title="Health" icon={<Heart className="w-4 h-4" />} loading={loading}>
            <motion.div
              key={isHealthy ? "healthy" : "unhealthy"}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <Badge
                variant={isHealthy ? "default" : "destructive"}
                className={isHealthy ? "bg-emerald-600 hover:bg-emerald-600" : ""}
              >
                {isHealthy ? "Healthy" : "Unhealthy"}
              </Badge>
            </motion.div>
          </StatusCard>
        </motion.div>

        <motion.div variants={staggerItem}>
          <StatusCard title="Uptime" icon={<Clock className="w-4 h-4" />} loading={loading}>
            <span className="text-lg font-semibold">{uptimeStr}</span>
          </StatusCard>
        </motion.div>

        <motion.div variants={staggerItem}>
          <StatusCard title="Version" icon={<Tag className="w-4 h-4" />} loading={loading}>
            <span className="text-lg font-semibold font-mono">{version}</span>
          </StatusCard>
        </motion.div>

        <motion.div variants={staggerItem}>
          <StatusCard title="Agents" icon={<Bot className="w-4 h-4" />} loading={loading}>
            <span className="text-lg font-semibold">
              <AnimatedNumber value={agentCount} />
            </span>
          </StatusCard>
        </motion.div>

        <motion.div variants={staggerItem}>
          <StatusCard title="Sessions" icon={<MessageSquare className="w-4 h-4" />} loading={loading}>
            <span className="text-lg font-semibold">
              <AnimatedNumber value={sessionCount} />
            </span>
          </StatusCard>
        </motion.div>

        <motion.div variants={staggerItem}>
          <StatusCard title="Cost Today" icon={<DollarSign className="w-4 h-4" />} loading={loading}>
            <span className="text-lg font-semibold">
              $<AnimatedNumber value={costToday} decimals={3} />
            </span>
          </StatusCard>
        </motion.div>
      </motion.div>

      {/* ── Zone 2: Charts Row ──────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
      >
        {/* Token Usage Area Chart */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Token Usage (7 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : tokenChartData.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                No usage data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={tokenChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradInput" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.inputTokens} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CHART_COLORS.inputTokens} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradOutput" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.outputTokens} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CHART_COLORS.outputTokens} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={formatCompactNumber} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} labelStyle={{ color: "hsl(var(--foreground))" }} formatter={(value: number) => [formatCompactNumber(value), undefined]} />
                  <Area type="monotone" dataKey="input" stroke={CHART_COLORS.inputTokens} fill="url(#gradInput)" strokeWidth={2} name="Input" />
                  <Area type="monotone" dataKey="output" stroke={CHART_COLORS.outputTokens} fill="url(#gradOutput)" strokeWidth={2} name="Output" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Cost Bar Chart */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Cost by Day (7 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : costChartData.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                No cost data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={costChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} labelStyle={{ color: "hsl(var(--foreground))" }} formatter={(value: number) => [`$${value.toFixed(4)}`, "Cost"]} />
                  <Bar dataKey="cost" fill={CHART_COLORS.cost} radius={[4, 4, 0, 0]} name="Cost" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Zone 3: Info Row ────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.3 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-4"
      >
        {/* Channel Health Strip */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Radio className="w-4 h-4" />
              Channel Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : channelList.length === 0 ? (
              <p className="text-muted-foreground text-sm">No channels configured</p>
            ) : (
              <div className="space-y-2">
                {channelList.map((ch) => {
                  const d = ch.detail;
                  const statusColor = d.connected ? "bg-emerald-500" : d.linked ? "bg-amber-500" : d.configured ? "bg-orange-500" : "bg-zinc-500";
                  const statusLabel = d.connected ? "Connected" : d.linked ? "Linked" : d.configured ? "Configured" : "Offline";
                  return (
                    <div key={ch.id} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <motion.span
                          className={`w-2 h-2 rounded-full ${statusColor}`}
                          key={`${ch.id}-${statusLabel}`}
                          initial={{ scale: 0.5 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 400 }}
                        />
                        <span className="text-sm font-medium">{ch.label}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{statusLabel}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Session Distribution Donut */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Sessions by Channel
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[180px] w-full" />
            ) : sessionsByChannel.length === 0 ? (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
                No session data
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={180}>
                  <PieChart>
                    <Pie data={sessionsByChannel} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2}>
                      {sessionsByChannel.map((_, i) => (
                        <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5">
                  {sessionsByChannel.slice(0, 6).map((entry, i) => (
                    <div key={entry.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                        <span className="truncate max-w-[80px]">{entry.name}</span>
                      </div>
                      <span className="text-muted-foreground font-mono text-xs">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Agents */}
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4" />
              Active Agents
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : !agents?.agents?.length ? (
              <p className="text-muted-foreground text-sm">No agents found</p>
            ) : (
              <div className="space-y-2">
                {agents.agents.map((agent) => (
                  <div key={agent.id} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      {agent.identity?.emoji && <span className="text-base">{agent.identity.emoji}</span>}
                      <span className="text-sm font-medium">{agent.identity?.name || agent.name || agent.id}</span>
                    </div>
                    {agent.id === defaultAgentId && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">default</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Zone 4: Recent Activity ─────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.3 }}
      >
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : recentSessions.length === 0 ? (
              <p className="text-muted-foreground text-sm">No recent sessions</p>
            ) : (
              <div className="divide-y divide-border">
                {recentSessions.map((session) => (
                  <div
                    key={session.key}
                    className="flex items-center justify-between py-2.5 cursor-pointer hover:bg-accent/30 -mx-2 px-2 rounded transition-colors"
                    onClick={() => router.push(`/chat?session=${encodeURIComponent(session.key)}`)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {session.channel && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">{session.channel}</Badge>
                      )}
                      <span className="text-sm truncate">{session.displayName || session.key}</span>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 text-xs text-muted-foreground">
                      {session.model && <span className="hidden sm:inline font-mono">{session.model}</span>}
                      {session.totalTokens != null && session.totalTokens > 0 && (
                        <span className="font-mono">{formatCompactNumber(session.totalTokens)}</span>
                      )}
                      {session.updatedAt && <span>{formatTimeAgo(session.updatedAt)}</span>}
                      <ArrowRight className="w-3 h-3 opacity-40" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Zone 5: Quick Actions ───────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={() => router.push("/chat")} variant="outline">
            <MessageSquare className="w-4 h-4" />
            Open Chat
            <ArrowRight className="w-3 h-3" />
          </Button>
          <Button onClick={() => router.push("/logs")} variant="outline">
            <ScrollText className="w-4 h-4" />
            View Logs
            <ArrowRight className="w-3 h-3" />
          </Button>
          <Button onClick={() => router.push("/sessions")} variant="outline">
            <MessageSquare className="w-4 h-4" />
            All Sessions
            <ArrowRight className="w-3 h-3" />
          </Button>
          <Button onClick={() => router.push("/usage")} variant="outline">
            <DollarSign className="w-4 h-4" />
            Usage Details
            <ArrowRight className="w-3 h-3" />
          </Button>
          {pendingApprovals > 0 && (
            <Button
              onClick={() => router.push("/approvals")}
              variant="outline"
              className="border-orange-500/50 text-orange-400"
            >
              <ShieldCheck className="w-4 h-4" />
              {pendingApprovals} Pending Approval{pendingApprovals > 1 ? "s" : ""}
              <ArrowRight className="w-3 h-3" />
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Shared Components ─────────────────────────────────────────────────────

function StatusCard({
  title,
  icon,
  loading,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-6 w-20" />
        ) : (
          <div className="flex items-center">{children}</div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Formatters ────────────────────────────────────────────────────────────

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function formatCompactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatShortDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatTimeAgo(ts: number): string {
  const now = Date.now();
  const diffMs = now - ts;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffDay > 0) return `${diffDay}d ago`;
  if (diffHr > 0) return `${diffHr}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return "just now";
}
