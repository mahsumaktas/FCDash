"use client";

import { useState, useEffect, useCallback } from "react";
import { useGatewayStore } from "@/stores/gateway";
import { useIsConnected } from "@/hooks/use-gateway";
import { useEvent } from "@/hooks/use-event";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
import {
  Clock,
  Plus,
  Play,
  Trash2,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import type { CronJob } from "@/lib/types";

export default function CronPage() {
  const rpc = useGatewayStore((s) => s.rpc);
  const isConnected = useIsConnected();

  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CronJob | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [running, setRunning] = useState<Record<string, boolean>>({});

  // Add job form
  const [newName, setNewName] = useState("");
  const [newExpr, setNewExpr] = useState("");
  const [newCmd, setNewCmd] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchJobs = useCallback(async () => {
    if (!isConnected) return;
    try {
      const result = await rpc("cron.list");
      setJobs(result);
    } catch {
      toast.error("Failed to load cron jobs");
    } finally {
      setLoading(false);
    }
  }, [isConnected, rpc]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Live cron event updates
  useEvent("cron", () => {
    fetchJobs();
  });

  const handleToggle = async (job: CronJob, enabled: boolean) => {
    try {
      await rpc("cron.update", { id: job.id, enabled });
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, enabled } : j))
      );
    } catch {
      toast.error("Failed to update job");
    }
  };

  const handleRun = async (job: CronJob) => {
    setRunning((prev) => ({ ...prev, [job.id]: true }));
    try {
      const result = await rpc("cron.run", { id: job.id });
      if (result.status === "error") {
        toast.error(`Job failed: ${result.error || "Unknown error"}`);
      } else {
        toast.success(`Job "${job.name}" executed`);
      }
    } catch {
      toast.error("Failed to run job");
    } finally {
      setRunning((prev) => {
        const next = { ...prev };
        delete next[job.id];
        return next;
      });
    }
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newExpr.trim() || !newCmd.trim()) return;
    setCreating(true);
    try {
      await rpc("cron.add", {
        name: newName.trim(),
        expression: newExpr.trim(),
        command: newCmd.trim(),
        enabled: true,
      });
      toast.success(`Job "${newName}" created`);
      setAddOpen(false);
      setNewName("");
      setNewExpr("");
      setNewCmd("");
      fetchJobs();
    } catch {
      toast.error("Failed to create job");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await rpc("cron.remove", { id: deleteTarget.id });
      toast.success(`Job "${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
      fetchJobs();
    } catch {
      toast.error("Failed to delete job");
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
          <h1 className="text-2xl font-bold">Scheduled Jobs</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage cron jobs and scheduled tasks
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4" />
          Add Job
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="py-4">
                <Skeleton className="h-5 w-full max-w-md" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Clock className="w-16 h-16 mb-4 opacity-20" />
          <p className="text-sm">No cron jobs configured. Add one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <Card key={job.id} className="hover:bg-accent/30 transition-colors">
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-3 shrink-0">
                    <Switch
                      checked={job.enabled}
                      onCheckedChange={(checked: boolean) => handleToggle(job, checked)}
                    />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{job.name}</span>
                      <Badge variant="outline" className="text-xs font-mono shrink-0">
                        {job.expression}
                      </Badge>
                      {!job.enabled && (
                        <Badge variant="secondary" className="text-xs">
                          Disabled
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      {job.command}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {job.lastRun && <span>Last: {job.lastRun}</span>}
                      {job.nextRun && <span>Next: {job.nextRun}</span>}
                      {job.lastResult && (
                        <span
                          className={
                            job.lastResult === "error"
                              ? "text-destructive"
                              : job.lastResult === "success"
                              ? "text-emerald-500"
                              : ""
                          }
                        >
                          Result: {job.lastResult}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRun(job)}
                      disabled={running[job.id]}
                      title="Run Now"
                    >
                      <Play className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(job)}
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

      {/* Add Job Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Scheduled Job</DialogTitle>
            <DialogDescription>
              Create a new cron job with a schedule expression and command.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cron-name">Name</Label>
              <Input
                id="cron-name"
                placeholder="My Job"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cron-expr">Cron Expression</Label>
              <Input
                id="cron-expr"
                placeholder="*/5 * * * *"
                className="font-mono"
                value={newExpr}
                onChange={(e) => setNewExpr(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Standard cron syntax (minute hour day month weekday)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cron-cmd">Command</Label>
              <Input
                id="cron-cmd"
                placeholder="Say hello to everyone"
                value={newCmd}
                onChange={(e) => setNewCmd(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !newName.trim() || !newExpr.trim() || !newCmd.trim()}
            >
              {creating ? "Creating..." : "Create Job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Job</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;? This cannot be undone.
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
