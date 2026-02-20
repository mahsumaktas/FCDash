"use client";

import { useState, useEffect, useCallback } from "react";
import { useGatewayStore } from "@/stores/gateway";
import { useIsConnected } from "@/hooks/use-gateway";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Bot, Plus, Star, Trash2, WifiOff } from "lucide-react";
import { toast } from "sonner";
import type { AgentSummary, AgentsListResult } from "@/lib/types";

export default function AgentsPage() {
  const rpc = useGatewayStore((s) => s.rpc);
  const isConnected = useIsConnected();

  const [data, setData] = useState<AgentsListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AgentSummary | null>(null);
  const [detailAgent, setDetailAgent] = useState<AgentSummary | null>(null);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchAgents = useCallback(async () => {
    if (!isConnected) return;
    try {
      const result = await rpc("agents.list");
      setData(result);
    } catch (err) {
      toast.error("Failed to load agents");
    } finally {
      setLoading(false);
    }
  }, [isConnected, rpc]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await rpc("agents.create", {
        id: newName.toLowerCase().replace(/\s+/g, "-"),
        name: newName.trim(),
        identity: {
          name: newName.trim(),
          emoji: newEmoji || undefined,
        },
      });
      toast.success(`Agent "${newName}" created`);
      setCreateOpen(false);
      setNewName("");
      setNewEmoji("");
      fetchAgents();
    } catch (err) {
      toast.error("Failed to create agent");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await rpc("agents.delete", { id: deleteTarget.id });
      toast.success(`Agent "${deleteTarget.name || deleteTarget.id}" deleted`);
      setDeleteTarget(null);
      if (detailAgent?.id === deleteTarget.id) setDetailAgent(null);
      fetchAgents();
    } catch (err) {
      toast.error("Failed to delete agent");
    } finally {
      setDeleting(false);
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agents</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your AI agents
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4" />
          New Agent
        </Button>
      </div>

      {/* Agent Grid */}
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
      ) : data?.agents?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Bot className="w-16 h-16 mb-4 opacity-20" />
          <p className="text-sm">No agents found. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.agents?.map((agent) => (
            <Card
              key={agent.id}
              className="cursor-pointer transition-colors hover:bg-accent/50"
              onClick={() => setDetailAgent(agent)}
            >
              <CardHeader className="pb-0">
                <CardTitle className="text-base flex items-center gap-2">
                  {agent.identity?.emoji ? (
                    <span className="text-xl">{agent.identity.emoji}</span>
                  ) : (
                    <Bot className="w-5 h-5 text-muted-foreground" />
                  )}
                  <span className="truncate">
                    {agent.identity?.name || agent.name || agent.id}
                  </span>
                  {agent.id === data?.defaultId && (
                    <Badge variant="secondary" className="ml-auto shrink-0">
                      <Star className="w-3 h-3" />
                      Default
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground font-mono truncate">
                  {agent.id}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Agent Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Agent</DialogTitle>
            <DialogDescription>
              Add a new AI agent to your gateway.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="agent-name">Name</Label>
              <Input
                id="agent-name"
                placeholder="My Agent"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-emoji">Emoji (optional)</Label>
              <Input
                id="agent-emoji"
                placeholder="e.g. 🤖"
                value={newEmoji}
                onChange={(e) => setNewEmoji(e.target.value)}
                maxLength={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating ? "Creating..." : "Create Agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Agent Detail Dialog */}
      <Dialog open={!!detailAgent} onOpenChange={(open: boolean) => !open && setDetailAgent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailAgent?.identity?.emoji && (
                <span className="text-xl">{detailAgent.identity.emoji}</span>
              )}
              {detailAgent?.identity?.name || detailAgent?.name || detailAgent?.id}
            </DialogTitle>
            <DialogDescription>Agent details</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">ID</span>
              <span className="font-mono">{detailAgent?.id}</span>
            </div>
            {detailAgent?.identity?.theme && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Theme</span>
                <span>{detailAgent.identity.theme}</span>
              </div>
            )}
            {detailAgent?.id === data?.defaultId && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Role</span>
                <Badge variant="secondary">
                  <Star className="w-3 h-3" />
                  Default Agent
                </Badge>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (detailAgent) {
                  setDeleteTarget(detailAgent);
                  setDetailAgent(null);
                }
              }}
              disabled={detailAgent?.id === data?.defaultId}
            >
              <Trash2 className="w-4 h-4" />
              Delete Agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Agent</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name || deleteTarget?.id}&quot;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
