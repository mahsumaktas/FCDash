"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Radio,
  LogOut,
  QrCode,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Search,
  RefreshCw,
  MessageSquare,
  Phone,
  MessageCircle,
  Globe,
  Mail,
  Send,
  Hash,
  Clock,
  User,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import type { ChannelsStatusResult, ChannelDetail, SessionSummary } from "@/lib/types";

// ─── Channel status classification ──────────────────────────────────────────

type ChannelStatus = "connected" | "configured" | "error" | "disconnected";

function classifyChannel(detail: ChannelDetail): ChannelStatus {
  if (detail.lastError) return "error";
  if (detail.linked && detail.connected) return "connected";
  if (detail.configured && !detail.linked) return "configured";
  if (detail.configured && detail.linked && !detail.connected) return "error";
  return "disconnected";
}

const STATUS_CONFIG: Record<
  ChannelStatus,
  { label: string; color: string; dotColor: string; bgColor: string; borderColor: string }
> = {
  connected: {
    label: "Connected",
    color: "text-emerald-400",
    dotColor: "bg-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
  },
  configured: {
    label: "Configured",
    color: "text-yellow-400",
    dotColor: "bg-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/20",
  },
  error: {
    label: "Error",
    color: "text-red-400",
    dotColor: "bg-red-500",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/20",
  },
  disconnected: {
    label: "Not Configured",
    color: "text-muted-foreground",
    dotColor: "bg-muted-foreground/50",
    bgColor: "bg-muted/30",
    borderColor: "border-muted",
  },
};

// ─── Channel icon mapping ────────────────────────────────────────────────────

function getChannelIcon(channelId: string) {
  const id = channelId.toLowerCase();
  if (id.includes("whatsapp") || id.includes("web")) return Phone;
  if (id.includes("telegram")) return Send;
  if (id.includes("discord")) return Hash;
  if (id.includes("slack")) return MessageCircle;
  if (id.includes("email") || id.includes("smtp") || id.includes("imap")) return Mail;
  if (id.includes("http") || id.includes("api") || id.includes("rest")) return Globe;
  if (id.includes("sms")) return MessageSquare;
  return Radio;
}

function getChannelColor(channelId: string): string {
  const id = channelId.toLowerCase();
  if (id.includes("whatsapp") || id.includes("web")) return "bg-green-500";
  if (id.includes("telegram")) return "bg-blue-500";
  if (id.includes("discord")) return "bg-indigo-500";
  if (id.includes("slack")) return "bg-purple-500";
  if (id.includes("email") || id.includes("smtp") || id.includes("imap")) return "bg-orange-500";
  if (id.includes("http") || id.includes("api") || id.includes("rest")) return "bg-cyan-500";
  if (id.includes("sms")) return "bg-pink-500";
  return "bg-muted-foreground";
}

// ─── Time formatting ─────────────────────────────────────────────────────────

function formatAuthAge(ms?: number): string {
  if (!ms || ms <= 0) return "Unknown";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// ─── Main Page Component ─────────────────────────────────────────────────────

export default function ChannelsPage() {
  const router = useRouter();

  const [data, setData] = useState<ChannelsStatusResult | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [logoutTarget, setLogoutTarget] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [qrDialog, setQrDialog] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrWaiting, setQrWaiting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [channelResult, sessionResult] = await Promise.allSettled([
        api.rpc("channels.status"),
        api.rpc("sessions.list", { limit: 100 }),
      ]);
      if (channelResult.status === "fulfilled") setData(channelResult.value);
      if (sessionResult.status === "fulfilled") setSessions(sessionResult.value?.sessions ?? []);
    } catch {
      toast.error("Failed to load channels");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
    toast.success("Channels refreshed");
  };

  // Count sessions per channel
  const sessionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of sessions) {
      if (s.channel) {
        counts[s.channel] = (counts[s.channel] || 0) + 1;
      }
    }
    return counts;
  }, [sessions]);

  // Build sorted channel list: errored/disconnected first, then configured, then connected
  const channels = data?.channels ?? {};
  const channelOrder = data?.channelOrder ?? Object.keys(channels);
  const channelLabels = data?.channelLabels ?? {};
  const channelDetailLabels = data?.channelDetailLabels ?? {};
  const channelAccounts = data?.channelAccounts ?? {};
  const channelDefaultAccountId = data?.channelDefaultAccountId ?? {};

  const sortedChannels = useMemo(() => {
    const statusPriority: Record<ChannelStatus, number> = {
      error: 0,
      configured: 1,
      disconnected: 2,
      connected: 3,
    };

    return channelOrder
      .filter((id) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        const label = channelLabels[id] || id;
        const detail = channels[id];
        return (
          label.toLowerCase().includes(q) ||
          id.toLowerCase().includes(q) ||
          detail?.accountId?.toLowerCase().includes(q) ||
          detail?.lastError?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const sa = classifyChannel(channels[a] ?? {});
        const sb = classifyChannel(channels[b] ?? {});
        return statusPriority[sa] - statusPriority[sb];
      });
  }, [channelOrder, channels, channelLabels, search]);

  // Summary stats
  const stats = useMemo(() => {
    const entries = channelOrder.map((id) => classifyChannel(channels[id] ?? {}));
    return {
      total: entries.length,
      connected: entries.filter((s) => s === "connected").length,
      configured: entries.filter((s) => s === "configured").length,
      error: entries.filter((s) => s === "error").length,
      disconnected: entries.filter((s) => s === "disconnected").length,
    };
  }, [channelOrder, channels]);

  const handleLogout = async () => {
    if (!logoutTarget) return;
    setLoggingOut(true);
    try {
      await api.rpc("channels.logout", { id: logoutTarget });
      toast.success("Logged out from channel");
      setLogoutTarget(null);
      fetchData();
    } catch {
      toast.error("Failed to logout");
    } finally {
      setLoggingOut(false);
    }
  };

  const handleQrLogin = async () => {
    setQrLoading(true);
    setQrDialog(true);
    setQrDataUrl(null);
    try {
      const result = await api.rpc("web.login.start");
      setQrDataUrl(result.qrDataUrl);
      setQrLoading(false);
      setQrWaiting(true);
      try {
        const waitResult = await api.rpc("web.login.wait", { timeoutMs: 60000 });
        if (waitResult.connected) {
          toast.success("WhatsApp connected successfully!");
          setQrDialog(false);
          fetchData();
        } else {
          toast.error(waitResult.message || "Connection timed out");
        }
      } catch {
        toast.error("Connection timed out or failed");
      } finally {
        setQrWaiting(false);
      }
    } catch {
      toast.error("Failed to start QR login");
      setQrLoading(false);
      setQrDialog(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Channels</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage messaging channel connections
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Stats bar */}
        {!loading && stats.total > 0 && (
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-medium">{stats.total}</span>
            </div>
            {stats.connected > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-muted-foreground">Connected:</span>
                <span className="font-medium text-emerald-400">{stats.connected}</span>
              </div>
            )}
            {stats.configured > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                <span className="text-muted-foreground">Configured:</span>
                <span className="font-medium text-yellow-400">{stats.configured}</span>
              </div>
            )}
            {stats.error > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-muted-foreground">Errors:</span>
                <span className="font-medium text-red-400">{stats.error}</span>
              </div>
            )}
            {stats.disconnected > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                <span className="text-muted-foreground">Not Configured:</span>
                <span className="font-medium">{stats.disconnected}</span>
              </div>
            )}
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search channels..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Channel grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-8 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : sortedChannels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Radio className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-sm">
              {search ? "No channels match your search." : "No channels configured."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedChannels.map((id) => {
              const detail = channels[id];
              if (!detail) return null;

              const label = channelLabels[id] || id;
              const detailLabel = channelDetailLabels[id];
              const status = classifyChannel(detail);
              const config = STATUS_CONFIG[status];
              const Icon = getChannelIcon(id);
              const iconBg = getChannelColor(id);
              const isWeb =
                id.toLowerCase().includes("web") ||
                id.toLowerCase().includes("whatsapp");
              const activeSessions = sessionCounts[id] || 0;
              const accounts = channelAccounts[id] ?? [];
              const defaultAccountId = channelDefaultAccountId[id];

              // Determine account display
              const linkedAccount =
                detail.accountId ||
                defaultAccountId ||
                (accounts.length > 0
                  ? accounts[0].displayName || accounts[0].accountId
                  : null);

              return (
                <Card
                  key={id}
                  className={`transition-all hover:shadow-md ${
                    status === "error"
                      ? "border-red-500/30 bg-red-500/5"
                      : status === "configured"
                      ? "border-yellow-500/20 bg-yellow-500/5"
                      : ""
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-3">
                      {/* Channel icon badge */}
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconBg}/15`}
                      >
                        <Icon
                          className={`w-5 h-5 ${iconBg.replace("bg-", "text-")}`}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base flex items-center gap-2">
                          <span className="truncate">{label}</span>
                          {/* Status dot */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className={`w-2.5 h-2.5 rounded-full shrink-0 ${config.dotColor} ${
                                  status === "connected" ? "animate-pulse" : ""
                                }`}
                              />
                            </TooltipTrigger>
                            <TooltipContent>{config.label}</TooltipContent>
                          </Tooltip>
                        </CardTitle>
                        {detailLabel && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {detailLabel}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    {/* Status badge row */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        className={`${config.bgColor} ${config.borderColor} ${config.color} border`}
                      >
                        {status === "connected" && (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        {status === "configured" && (
                          <AlertCircle className="w-3 h-3" />
                        )}
                        {status === "error" && <XCircle className="w-3 h-3" />}
                        {status === "disconnected" && (
                          <XCircle className="w-3 h-3" />
                        )}
                        {config.label}
                      </Badge>

                      {activeSessions > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="text-xs">
                              <MessageSquare className="w-3 h-3" />
                              {activeSessions} active
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            {activeSessions} active chat session
                            {activeSessions !== 1 ? "s" : ""} on this channel
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>

                    {/* Detail rows */}
                    <div className="space-y-2 text-xs">
                      {/* Account info */}
                      {linkedAccount && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <User className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            <span className="text-foreground font-medium">
                              {linkedAccount}
                            </span>
                          </span>
                        </div>
                      )}

                      {/* Phone number for WhatsApp-like channels */}
                      {detail.self?.e164 && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="w-3.5 h-3.5 shrink-0" />
                          <span className="text-foreground">{detail.self.e164}</span>
                        </div>
                      )}

                      {/* Auth age */}
                      {detail.authAgeMs != null && detail.authAgeMs > 0 && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            Authenticated{" "}
                            <span className="text-foreground">
                              {formatAuthAge(detail.authAgeMs)}
                            </span>
                          </span>
                        </div>
                      )}

                      {/* Multiple accounts */}
                      {accounts.length > 1 && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <User className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {accounts.length} accounts linked
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Error section */}
                    {detail.lastError && (
                      <div className="rounded-md bg-red-500/10 border border-red-500/20 p-2.5">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-red-400 break-words line-clamp-3">
                            {detail.lastError}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {detail.linked && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLogoutTarget(id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          Logout
                        </Button>
                      )}

                      {isWeb && !detail.linked && (
                        <Button variant="outline" size="sm" onClick={handleQrLogin}>
                          <QrCode className="w-3.5 h-3.5" />
                          Connect via QR
                        </Button>
                      )}

                      {activeSessions > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                router.push(
                                  `/sessions?channel=${encodeURIComponent(id)}`
                                )
                              }
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Sessions
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            View sessions for this channel
                          </TooltipContent>
                        </Tooltip>
                      )}

                      {(status === "error" || (status === "configured" && detail.linked)) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleRefresh}
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Reconnect
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Refresh channel status</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Logout Confirmation Dialog */}
        <Dialog
          open={!!logoutTarget}
          onOpenChange={(open: boolean) => !open && setLogoutTarget(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Logout from Channel</DialogTitle>
              <DialogDescription>
                Are you sure you want to logout from &quot;
                {logoutTarget
                  ? channelLabels[logoutTarget] || logoutTarget
                  : ""}
                &quot;? You will need to re-authenticate to use this channel.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLogoutTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                {loggingOut && <Loader2 className="w-4 h-4 animate-spin" />}
                {loggingOut ? "Logging out..." : "Logout"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* QR Code Dialog */}
        <Dialog
          open={qrDialog}
          onOpenChange={(open: boolean) => {
            if (!open) {
              setQrDialog(false);
              setQrDataUrl(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Connect WhatsApp</DialogTitle>
              <DialogDescription>
                Scan this QR code with your WhatsApp mobile app to connect.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-center py-4">
              {qrLoading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Generating QR code...
                  </span>
                </div>
              ) : qrDataUrl ? (
                <div className="space-y-3 text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUrl}
                    alt="WhatsApp QR Code"
                    className="w-64 h-64 rounded-lg bg-white p-2"
                  />
                  {qrWaiting && (
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Waiting for scan...
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Failed to generate QR code
                </span>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
