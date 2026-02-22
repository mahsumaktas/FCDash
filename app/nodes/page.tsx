"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "@/lib/api-client";
import { useEvent } from "@/hooks/use-event";
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
  Server,
  Smartphone,
  Pencil,
  Check,
  X,
  Trash2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Monitor,
  Globe,
  Terminal,
  Cpu,
  Wifi,
  Clock,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type { NodeInfo, DeviceInfo, PresenceEntry } from "@/lib/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(ts: number | undefined): string | null {
  if (!ts) return null;
  const now = Date.now();
  const diffMs = now - ts;
  if (diffMs < 0) return "just now";
  if (diffMs < 60_000) return `${Math.round(diffMs / 1000)}s ago`;
  if (diffMs < 3_600_000) return `${Math.round(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.round(diffMs / 3_600_000)}h ago`;
  return `${Math.round(diffMs / 86_400_000)}d ago`;
}

function platformIcon(platform?: string) {
  if (!platform) return <Server className="w-4 h-4 text-muted-foreground" />;
  const p = platform.toLowerCase();
  if (p.includes("darwin") || p.includes("mac"))
    return <Monitor className="w-4 h-4 text-muted-foreground" />;
  if (p.includes("ios") || p.includes("iphone") || p.includes("ipad"))
    return <Smartphone className="w-4 h-4 text-muted-foreground" />;
  if (p.includes("android"))
    return <Smartphone className="w-4 h-4 text-muted-foreground" />;
  if (p.includes("win"))
    return <Monitor className="w-4 h-4 text-muted-foreground" />;
  if (p.includes("linux"))
    return <Terminal className="w-4 h-4 text-muted-foreground" />;
  return <Server className="w-4 h-4 text-muted-foreground" />;
}

const CAP_COLORS: Record<string, string> = {
  exec: "bg-blue-500/15 text-blue-600 border-blue-500/25",
  tts: "bg-purple-500/15 text-purple-600 border-purple-500/25",
  stt: "bg-indigo-500/15 text-indigo-600 border-indigo-500/25",
  browser: "bg-orange-500/15 text-orange-600 border-orange-500/25",
  camera: "bg-pink-500/15 text-pink-600 border-pink-500/25",
  microphone: "bg-rose-500/15 text-rose-600 border-rose-500/25",
  clipboard: "bg-cyan-500/15 text-cyan-600 border-cyan-500/25",
  notifications: "bg-amber-500/15 text-amber-600 border-amber-500/25",
  files: "bg-emerald-500/15 text-emerald-600 border-emerald-500/25",
};

function capBadgeClass(cap: string): string {
  return CAP_COLORS[cap.toLowerCase()] ?? "bg-muted text-muted-foreground";
}

// ── Node Card ────────────────────────────────────────────────────────────────

function NodeCard({
  node,
  isOnline,
  onRename,
}: {
  node: NodeInfo;
  isOnline: boolean;
  onRename: (id: string, name: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [commandsExpanded, setCommandsExpanded] = useState(false);

  const handleStartEdit = () => {
    setEditing(true);
    setEditName(node.displayName || "");
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) return;
    await onRename(node.id, editName.trim());
    setEditing(false);
    setEditName("");
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditName("");
  };

  return (
    <Card className={isOnline ? "border-emerald-500/30" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {platformIcon(node.platform)}
          {editing ? (
            <div className="flex items-center gap-1 flex-1">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-7 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveEdit();
                  if (e.key === "Escape") handleCancelEdit();
                }}
              />
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleSaveEdit}
              >
                <Check className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleCancelEdit}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <>
              <span className="truncate">
                {node.displayName || node.id}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                className="shrink-0 ml-auto"
                onClick={handleStartEdit}
                title="Rename"
              >
                <Pencil className="w-3 h-3" />
              </Button>
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Status & Platform */}
        <div className="flex flex-wrap gap-1.5">
          <Badge
            className={
              isOnline
                ? "bg-emerald-600 hover:bg-emerald-600 text-white"
                : "bg-gray-500 hover:bg-gray-500 text-white"
            }
          >
            <span
              className={`w-1.5 h-1.5 rounded-full mr-1 ${
                isOnline ? "bg-white animate-pulse" : "bg-gray-300"
              }`}
            />
            {isOnline ? "Online" : "Offline"}
          </Badge>
          {node.platform && (
            <Badge variant="outline" className="text-xs">
              {node.platform}
            </Badge>
          )}
          {node.deviceFamily && (
            <Badge variant="outline" className="text-xs">
              {node.deviceFamily}
            </Badge>
          )}
        </div>

        {/* Capabilities */}
        {node.caps && node.caps.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-1.5 font-medium">
              Capabilities
            </div>
            <div className="flex flex-wrap gap-1">
              {node.caps.map((cap) => (
                <Badge
                  key={cap}
                  variant="outline"
                  className={`text-xs ${capBadgeClass(cap)}`}
                >
                  {cap}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Device Details */}
        <div className="space-y-1 text-xs text-muted-foreground">
          {node.version && (
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3 h-3" />
              Version: {node.version}
              {node.coreVersion && ` (core: ${node.coreVersion})`}
            </div>
          )}
          {node.modelIdentifier && (
            <div className="flex items-center gap-1.5">
              <Server className="w-3 h-3" />
              Model: {node.modelIdentifier}
            </div>
          )}
          {node.lastSeen && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              Last seen: {relativeTime(node.lastSeen)}
            </div>
          )}
          <div className="font-mono truncate text-[10px] opacity-60">
            {node.id}
          </div>
        </div>

        {/* Commands (expandable) */}
        {node.commands && node.commands.length > 0 && (
          <div>
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors font-medium"
              onClick={() => setCommandsExpanded(!commandsExpanded)}
            >
              {commandsExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              Commands ({node.commands.length})
            </button>
            {commandsExpanded && (
              <div className="mt-1.5 space-y-0.5">
                {node.commands.map((cmd) => (
                  <div
                    key={cmd}
                    className="text-xs font-mono bg-muted/50 rounded px-2 py-1"
                  >
                    {cmd}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Presence Row ─────────────────────────────────────────────────────────────

function PresenceRow({ entry }: { entry: PresenceEntry }) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-md bg-muted/30">
      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium truncate">
            {entry.host || entry.instanceId || "Unknown"}
          </span>
          {entry.platform && (
            <Badge variant="outline" className="text-xs">
              {entry.platform}
            </Badge>
          )}
          {entry.mode && (
            <Badge variant="outline" className="text-xs">
              {entry.mode}
            </Badge>
          )}
          {entry.roles && entry.roles.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {entry.roles.join(", ")}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
          {entry.ip && <span>{entry.ip}</span>}
          {entry.version && <span>v{entry.version}</span>}
          {entry.deviceFamily && <span>{entry.deviceFamily}</span>}
          {entry.ts && <span>{relativeTime(entry.ts)}</span>}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function NodesPage() {

  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [pendingDevices, setPendingDevices] = useState<DeviceInfo[]>([]);
  const [presence, setPresence] = useState<PresenceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [removeDevice, setRemoveDevice] = useState<DeviceInfo | null>(null);
  const [removing, setRemoving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [nodesRes, devicesRes, presenceRes] = await Promise.allSettled([
        api.rpc("node.list"),
        api.rpc("device.pair.list"),
        api.rpc("system-presence" as Parameters<typeof api.rpc>[0]),
      ]);
      if (nodesRes.status === "fulfilled")
        setNodes(nodesRes.value?.nodes ?? []);
      if (devicesRes.status === "fulfilled") {
        setDevices(devicesRes.value?.paired ?? []);
        setPendingDevices(devicesRes.value?.pending ?? []);
      }
      if (presenceRes.status === "fulfilled") {
        const entries = presenceRes.value;
        setPresence(Array.isArray(entries) ? entries : []);
      }
    } catch {
      toast.error("Failed to load nodes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Live updates
  useEvent("device.pair.requested", () => fetchData());
  useEvent("device.pair.resolved", () => fetchData());
  useEvent("node.pair.requested", () => fetchData());
  useEvent("node.pair.resolved", () => fetchData());
  useEvent("presence", () => fetchData());

  // Determine online node IDs from presence data
  const onlineNodeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const entry of presence) {
      if (entry.deviceId) ids.add(entry.deviceId);
      if (entry.instanceId) ids.add(entry.instanceId);
    }
    return ids;
  }, [presence]);

  const isNodeOnline = useCallback(
    (node: NodeInfo) => {
      if (node.status === "online") return true;
      if (onlineNodeIds.has(node.id)) return true;
      // Consider online if lastSeen within 2 minutes
      if (node.lastSeen && Date.now() - node.lastSeen < 120_000) return true;
      return false;
    },
    [onlineNodeIds]
  );

  // Split nodes into online and offline
  const { onlineNodes, offlineNodes } = useMemo(() => {
    const online: NodeInfo[] = [];
    const offline: NodeInfo[] = [];
    for (const node of nodes) {
      if (isNodeOnline(node)) {
        online.push(node);
      } else {
        offline.push(node);
      }
    }
    return { onlineNodes: online, offlineNodes: offline };
  }, [nodes, isNodeOnline]);

  const handleRename = async (nodeId: string, displayName: string) => {
    try {
      await api.rpc("node.rename", { nodeId, displayName });
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId ? { ...n, displayName } : n
        )
      );
      toast.success("Node renamed");
    } catch {
      toast.error("Failed to rename node");
    }
  };

  const handleDeviceApprove = async (deviceId: string) => {
    try {
      await api.rpc("device.pair.approve", { deviceId });
      toast.success("Device approved");
      fetchData();
    } catch {
      toast.error("Failed to approve device");
    }
  };

  const handleDeviceReject = async (deviceId: string) => {
    try {
      await api.rpc("device.pair.reject", { deviceId });
      toast.success("Device rejected");
      fetchData();
    } catch {
      toast.error("Failed to reject device");
    }
  };

  const handleDeviceRemove = async () => {
    if (!removeDevice) return;
    setRemoving(true);
    try {
      await api.rpc("device.pair.remove", { deviceId: removeDevice.deviceId });
      toast.success("Device removed");
      setRemoveDevice(null);
      fetchData();
    } catch {
      toast.error("Failed to remove device");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="p-6 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Nodes</h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
            Nodes are remote compute endpoints that execute commands for your
            agents. Devices must be paired before they can connect as nodes.
          </p>
        </div>

        {/* Summary Stats */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div className="rounded-md bg-primary/10 p-2">
                  <Server className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{nodes.length}</div>
                  <div className="text-xs text-muted-foreground">
                    Total Nodes
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div className="rounded-md bg-emerald-500/10 p-2">
                  <Wifi className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {onlineNodes.length}
                  </div>
                  <div className="text-xs text-muted-foreground">Online</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div className="rounded-md bg-blue-500/10 p-2">
                  <Smartphone className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{devices.length}</div>
                  <div className="text-xs text-muted-foreground">
                    Paired Devices
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div className="rounded-md bg-purple-500/10 p-2">
                  <Users className="w-4 h-4 text-purple-500" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{presence.length}</div>
                  <div className="text-xs text-muted-foreground">
                    Connected
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Pending Pairing Requests */}
        {pendingDevices.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              Pending Pairing Requests
              <Badge variant="destructive" className="text-xs">
                {pendingDevices.length}
              </Badge>
            </h2>
            <div className="space-y-2">
              {pendingDevices.map((device) => (
                <Card
                  key={device.deviceId}
                  className="border-orange-500/30 hover:bg-accent/30 transition-colors"
                >
                  <CardContent className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-md bg-orange-500/10 p-2">
                        <Smartphone className="w-4 h-4 text-orange-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {device.displayName || device.deviceId}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-xs text-orange-500 border-orange-500/30"
                          >
                            Pending
                          </Badge>
                          {device.platform && (
                            <Badge variant="outline" className="text-xs">
                              {device.platform}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                          {device.deviceId}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleDeviceApprove(device.deviceId)
                              }
                              className="text-emerald-500 hover:text-emerald-500"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Approve</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleDeviceReject(device.deviceId)
                              }
                              className="text-destructive hover:text-destructive"
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Reject</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Connected Nodes */}
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            Connected Nodes
            {onlineNodes.length > 0 && (
              <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-xs">
                {onlineNodes.length} online
              </Badge>
            )}
          </h2>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-5 w-32" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-48 mb-2" />
                    <Skeleton className="h-4 w-32" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Server className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm">No nodes connected.</p>
              <p className="text-xs mt-1">
                Pair a device to register it as a node.
              </p>
            </div>
          ) : (
            <>
              {onlineNodes.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {onlineNodes.map((node) => (
                    <NodeCard
                      key={node.id}
                      node={node}
                      isOnline={true}
                      onRename={handleRename}
                    />
                  ))}
                </div>
              )}

              {offlineNodes.length > 0 && (
                <div className="mt-4">
                  {onlineNodes.length > 0 && (
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">
                      Offline ({offlineNodes.length})
                    </h3>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {offlineNodes.map((node) => (
                      <NodeCard
                        key={node.id}
                        node={node}
                        isOnline={false}
                        onRename={handleRename}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Paired Devices */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Paired Devices</h2>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="py-3">
                    <Skeleton className="h-5 w-64" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : devices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Smartphone className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm">No paired devices.</p>
              <p className="text-xs mt-1">
                Devices must be paired before they can connect as nodes.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {devices.map((device) => (
                <Card
                  key={device.deviceId}
                  className="hover:bg-accent/30 transition-colors"
                >
                  <CardContent className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-md bg-muted p-2">
                        <Smartphone className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate">
                            {device.displayName || device.deviceId}
                          </span>
                          {device.role && (
                            <Badge variant="outline" className="text-xs">
                              {device.role}
                            </Badge>
                          )}
                          {device.platform && (
                            <Badge variant="outline" className="text-xs">
                              {device.platform}
                            </Badge>
                          )}
                          {device.scopes && device.scopes.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {device.scopes.join(", ")}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-muted-foreground font-mono truncate">
                            {device.deviceId}
                          </span>
                          {device.lastSeen && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {relativeTime(device.lastSeen)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setRemoveDevice(device)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Remove Device</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Active Connections (Presence) */}
        {presence.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              Active Connections
              <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-xs">
                {presence.length}
              </Badge>
            </h2>
            <p className="text-sm text-muted-foreground mb-3">
              Currently connected clients and instances.
            </p>
            <div className="space-y-1.5">
              {presence.map((entry, i) => (
                <PresenceRow key={entry.instanceId || i} entry={entry} />
              ))}
            </div>
          </div>
        )}

        {/* Remove Device Confirmation */}
        <Dialog
          open={!!removeDevice}
          onOpenChange={(open: boolean) => !open && setRemoveDevice(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove Device</DialogTitle>
              <DialogDescription>
                Are you sure you want to remove device &quot;
                {removeDevice?.displayName || removeDevice?.deviceId}&quot;? The
                device will need to re-pair to connect again.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRemoveDevice(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeviceRemove}
                disabled={removing}
              >
                {removing ? "Removing..." : "Remove"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
