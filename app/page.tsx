"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useGatewayStore } from "@/stores/gateway";
import { useIsConnected } from "@/hooks/use-gateway";
import { useEvent } from "@/hooks/use-event";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Heart,
  Clock,
  Tag,
  Fingerprint,
  Bot,
  MessageSquare,
  Radio,
  ShieldCheck,
  ArrowRight,
  ScrollText,
  WifiOff,
} from "lucide-react";
import type { HealthStatus, AgentsListResult, SessionSummary, ChannelsStatusResult } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const rpc = useGatewayStore((s) => s.rpc);
  const hello = useGatewayStore((s) => s.hello);
  const snapshot = useGatewayStore((s) => s.snapshot);
  const isConnected = useIsConnected();

  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [agents, setAgents] = useState<AgentsListResult | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [channels, setChannels] = useState<ChannelsStatusResult | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!isConnected) return;
    try {
      const [healthRes, agentsRes, sessionsRes, channelsRes] = await Promise.allSettled([
        rpc("health"),
        rpc("agents.list"),
        rpc("sessions.list", { limit: 100 }),
        rpc("channels.status"),
      ]);
      if (healthRes.status === "fulfilled") setHealth(healthRes.value);
      if (agentsRes.status === "fulfilled") setAgents(agentsRes.value);
      if (sessionsRes.status === "fulfilled") setSessions(sessionsRes.value);
      if (channelsRes.status === "fulfilled") setChannels(channelsRes.value);
    } catch {
      // Silently handle — individual cards show their own state
    } finally {
      setLoading(false);
    }
  }, [isConnected, rpc]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Live health updates
  useEvent("health", () => {
    rpc("health").then(setHealth).catch(() => {});
  });

  // Track pending approvals
  useEvent("exec.approval.requested", () => {
    setPendingApprovals((c) => c + 1);
  });
  useEvent("exec.approval.resolved", () => {
    setPendingApprovals((c) => Math.max(0, c - 1));
  });

  const uptimeStr = snapshot?.uptimeMs
    ? formatUptime(snapshot.uptimeMs)
    : "--";
  const version = hello?.server?.version ?? "--";
  const gatewayId = hello?.server?.connId
    ? hello.server.connId.slice(0, 8)
    : "--";
  const isHealthy = health?.ok ?? false;
  const agentCount = agents?.agents?.length ?? 0;
  const activeSessionCount = sessions?.length ?? 0;
  const channelCount = channels?.channels
    ? Object.keys(channels.channels).length
    : 0;
  const linkedChannels = channels?.channels
    ? Object.values(channels.channels).filter((c) => c.linked).length
    : 0;

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
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          System overview and quick actions
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard
          title="Health"
          icon={<Heart className="w-4 h-4" />}
          loading={loading}
        >
          <Badge
            variant={isHealthy ? "default" : "destructive"}
            className={isHealthy ? "bg-emerald-600 hover:bg-emerald-600" : ""}
          >
            {isHealthy ? "Healthy" : "Unhealthy"}
          </Badge>
          {health?.durationMs != null && (
            <span className="text-xs text-muted-foreground ml-2">
              {health.durationMs}ms
            </span>
          )}
        </StatusCard>

        <StatusCard
          title="Uptime"
          icon={<Clock className="w-4 h-4" />}
          loading={loading}
        >
          <span className="text-xl font-semibold">{uptimeStr}</span>
        </StatusCard>

        <StatusCard
          title="Version"
          icon={<Tag className="w-4 h-4" />}
          loading={loading}
        >
          <span className="text-xl font-semibold font-mono">{version}</span>
        </StatusCard>

        <StatusCard
          title="Gateway ID"
          icon={<Fingerprint className="w-4 h-4" />}
          loading={loading}
        >
          <span className="text-xl font-semibold font-mono">{gatewayId}</span>
        </StatusCard>
      </div>

      {/* Resource Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ResourceCard
          title="Agents"
          value={agentCount}
          icon={<Bot className="w-4 h-4" />}
          loading={loading}
          onClick={() => router.push("/agents")}
        />
        <ResourceCard
          title="Active Sessions"
          value={activeSessionCount}
          icon={<MessageSquare className="w-4 h-4" />}
          loading={loading}
          onClick={() => router.push("/sessions")}
        />
        <ResourceCard
          title="Channels"
          value={`${linkedChannels}/${channelCount}`}
          subtitle="linked"
          icon={<Radio className="w-4 h-4" />}
          loading={loading}
          onClick={() => router.push("/channels")}
        />
        <ResourceCard
          title="Pending Approvals"
          value={pendingApprovals}
          icon={<ShieldCheck className="w-4 h-4" />}
          loading={loading}
          onClick={() => router.push("/approvals")}
          highlight={pendingApprovals > 0}
        />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
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
        </CardContent>
      </Card>
    </div>
  );
}

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
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <div className="flex items-center">{children}</div>
        )}
      </CardContent>
    </Card>
  );
}

function ResourceCard({
  title,
  value,
  subtitle,
  icon,
  loading,
  onClick,
  highlight,
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  loading: boolean;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <Card
      className={`cursor-pointer transition-colors hover:bg-accent/50 ${highlight ? "border-orange-500/50" : ""}`}
      onClick={onClick}
    >
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${highlight ? "text-orange-400" : ""}`}>
              {value}
            </span>
            {subtitle && (
              <span className="text-xs text-muted-foreground">{subtitle}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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
