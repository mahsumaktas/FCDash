"use client";

import { useState, useEffect, useCallback } from "react";
import { useGatewayStore } from "@/stores/gateway";
import { useIsConnected } from "@/hooks/use-gateway";
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
  Server,
  Smartphone,
  Pencil,
  Check,
  X,
  Trash2,
  WifiOff,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { NodeInfo, DeviceInfo } from "@/lib/types";

export default function NodesPage() {
  const rpc = useGatewayStore((s) => s.rpc);
  const isConnected = useIsConnected();

  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [removeDevice, setRemoveDevice] = useState<DeviceInfo | null>(null);
  const [removing, setRemoving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!isConnected) return;
    try {
      const [nodesRes, devicesRes] = await Promise.allSettled([
        rpc("node.list"),
        rpc("device.pair.list"),
      ]);
      if (nodesRes.status === "fulfilled") setNodes(nodesRes.value);
      if (devicesRes.status === "fulfilled") setDevices(devicesRes.value);
    } catch {
      toast.error("Failed to load nodes");
    } finally {
      setLoading(false);
    }
  }, [isConnected, rpc]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Live updates for device pairing
  useEvent("device.pair.requested", () => {
    fetchData();
  });
  useEvent("device.pair.resolved", () => {
    fetchData();
  });
  useEvent("node.pair.requested", () => {
    fetchData();
  });
  useEvent("node.pair.resolved", () => {
    fetchData();
  });

  const handleRename = async (nodeId: string) => {
    if (!editName.trim()) return;
    try {
      await rpc("node.rename", { nodeId, displayName: editName.trim() });
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId ? { ...n, displayName: editName.trim() } : n
        )
      );
      toast.success("Node renamed");
    } catch {
      toast.error("Failed to rename node");
    }
    setEditingNode(null);
    setEditName("");
  };

  const handleDeviceApprove = async (deviceId: string) => {
    try {
      await rpc("device.pair.approve", { deviceId });
      toast.success("Device approved");
      fetchData();
    } catch {
      toast.error("Failed to approve device");
    }
  };

  const handleDeviceReject = async (deviceId: string) => {
    try {
      await rpc("device.pair.reject", { deviceId });
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
      await rpc("device.pair.remove", { deviceId: removeDevice.deviceId });
      toast.success("Device removed");
      setRemoveDevice(null);
      fetchData();
    } catch {
      toast.error("Failed to remove device");
    } finally {
      setRemoving(false);
    }
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
    <div className="p-6 space-y-8">
      {/* Nodes Section */}
      <div>
        <h1 className="text-2xl font-bold">Nodes</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Connected nodes and device pairing
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Nodes</h2>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-48" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Server className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm">No nodes connected.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {nodes.map((node) => (
              <Card key={node.id}>
                <CardHeader className="pb-0">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Server className="w-4 h-4 text-muted-foreground" />
                    {editingNode === node.id ? (
                      <div className="flex items-center gap-1 flex-1">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-7 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRename(node.id);
                            if (e.key === "Escape") {
                              setEditingNode(null);
                              setEditName("");
                            }
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleRename(node.id)}
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => {
                            setEditingNode(null);
                            setEditName("");
                          }}
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
                          onClick={() => {
                            setEditingNode(node.id);
                            setEditName(node.displayName || "");
                          }}
                          title="Rename"
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {node.status && (
                      <Badge
                        className={
                          node.status === "online"
                            ? "bg-emerald-600 hover:bg-emerald-600 text-white"
                            : "bg-gray-500 hover:bg-gray-500 text-white"
                        }
                      >
                        {node.status}
                      </Badge>
                    )}
                    {node.platform && (
                      <Badge variant="outline" className="text-xs">
                        {node.platform}
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-0.5 text-xs text-muted-foreground">
                    {node.version && <div>Version: {node.version}</div>}
                    {node.deviceFamily && <div>Device: {node.deviceFamily}</div>}
                    <div className="font-mono truncate">ID: {node.id}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Devices Section */}
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
          </div>
        ) : (
          <div className="space-y-2">
            {devices.map((device) => (
              <Card key={device.deviceId} className="hover:bg-accent/30 transition-colors">
                <CardContent className="py-3">
                  <div className="flex items-center gap-3">
                    <Smartphone className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
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
                      </div>
                      <div className="text-xs text-muted-foreground font-mono truncate">
                        {device.deviceId}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* If device has no role, show approve/reject */}
                      {!device.role && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeviceApprove(device.deviceId)}
                            title="Approve"
                            className="text-emerald-500 hover:text-emerald-500"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeviceReject(device.deviceId)}
                            title="Reject"
                            className="text-destructive hover:text-destructive"
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRemoveDevice(device)}
                        title="Remove"
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
      </div>

      {/* Remove Device Confirmation */}
      <Dialog open={!!removeDevice} onOpenChange={(open: boolean) => !open && setRemoveDevice(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Device</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove device &quot;{removeDevice?.displayName || removeDevice?.deviceId}&quot;?
              The device will need to re-pair to connect again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveDevice(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeviceRemove} disabled={removing}>
              {removing ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
