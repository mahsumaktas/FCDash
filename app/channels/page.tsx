"use client";

import { useState, useEffect, useCallback } from "react";
import { useGatewayStore } from "@/stores/gateway";
import { useIsConnected } from "@/hooks/use-gateway";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Radio,
  LogOut,
  QrCode,
  CheckCircle2,
  XCircle,
  AlertCircle,
  WifiOff,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { ChannelsStatusResult, ChannelDetail } from "@/lib/types";

function getChannelStatus(detail: ChannelDetail) {
  if (detail.linked && detail.connected) return "linked";
  if (detail.configured) return "configured";
  return "disconnected";
}

function getStatusBadge(detail: ChannelDetail) {
  const status = getChannelStatus(detail);
  switch (status) {
    case "linked":
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">
          <CheckCircle2 className="w-3 h-3" />
          Linked
        </Badge>
      );
    case "configured":
      return (
        <Badge className="bg-yellow-600 hover:bg-yellow-600 text-white">
          <AlertCircle className="w-3 h-3" />
          Configured
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary">
          <XCircle className="w-3 h-3" />
          Disconnected
        </Badge>
      );
  }
}

export default function ChannelsPage() {
  const rpc = useGatewayStore((s) => s.rpc);
  const isConnected = useIsConnected();

  const [data, setData] = useState<ChannelsStatusResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [logoutTarget, setLogoutTarget] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [qrDialog, setQrDialog] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrWaiting, setQrWaiting] = useState(false);

  const fetchChannels = useCallback(async () => {
    if (!isConnected) return;
    try {
      const result = await rpc("channels.status");
      setData(result);
    } catch {
      toast.error("Failed to load channels");
    } finally {
      setLoading(false);
    }
  }, [isConnected, rpc]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  const handleLogout = async () => {
    if (!logoutTarget) return;
    setLoggingOut(true);
    try {
      await rpc("channels.logout", { id: logoutTarget });
      toast.success("Logged out from channel");
      setLogoutTarget(null);
      fetchChannels();
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
      const result = await rpc("web.login.start");
      setQrDataUrl(result.qrDataUrl);
      setQrLoading(false);
      // Start waiting for connection
      setQrWaiting(true);
      try {
        const waitResult = await rpc("web.login.wait", { timeoutMs: 60000 });
        if (waitResult.connected) {
          toast.success("WhatsApp connected successfully!");
          setQrDialog(false);
          fetchChannels();
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

  const channels = data?.channels ?? {};
  const channelOrder = data?.channelOrder ?? Object.keys(channels);
  const channelLabels = data?.channelLabels ?? {};

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
        <h1 className="text-2xl font-bold">Channels</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage messaging channel connections
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : channelOrder.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Radio className="w-16 h-16 mb-4 opacity-20" />
          <p className="text-sm">No channels configured.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {channelOrder.map((id) => {
            const detail = channels[id];
            if (!detail) return null;
            const label = channelLabels[id] || id;
            const isWeb = id.toLowerCase().includes("web") || id.toLowerCase().includes("whatsapp");

            return (
              <Card key={id}>
                <CardHeader className="pb-0">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Radio className="w-4 h-4 text-muted-foreground" />
                    <span className="truncate">{label}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    {getStatusBadge(detail)}
                  </div>

                  <div className="space-y-1 text-xs text-muted-foreground">
                    {detail.accountId && (
                      <div>Account: <span className="text-foreground">{detail.accountId}</span></div>
                    )}
                    {detail.self?.e164 && (
                      <div>Phone: <span className="text-foreground">{detail.self.e164}</span></div>
                    )}
                    {detail.lastError && (
                      <div className="text-destructive">Error: {detail.lastError}</div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {detail.linked && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLogoutTarget(id)}
                      >
                        <LogOut className="w-4 h-4" />
                        Logout
                      </Button>
                    )}
                    {isWeb && !detail.linked && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleQrLogin}
                      >
                        <QrCode className="w-4 h-4" />
                        Connect via QR
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Logout Confirmation */}
      <Dialog open={!!logoutTarget} onOpenChange={(open: boolean) => !open && setLogoutTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Logout from Channel</DialogTitle>
            <DialogDescription>
              Are you sure you want to logout from &quot;{logoutTarget}&quot;? You will need to re-authenticate to use this channel.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogoutTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? "Logging out..." : "Logout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={qrDialog} onOpenChange={(open: boolean) => {
        if (!open) {
          setQrDialog(false);
          setQrDataUrl(null);
        }
      }}>
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
                <span className="text-sm text-muted-foreground">Generating QR code...</span>
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
  );
}
