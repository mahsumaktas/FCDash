"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "@/lib/api-client";
import { useEvent } from "@/hooks/use-event";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Search,
  ChevronDown,
  ChevronRight,
  Timer,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import type { CronJob, CronRunResult } from "@/lib/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string | undefined): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const now = Date.now();
  const diffMs = now - date.getTime();
  const absDiff = Math.abs(diffMs);
  const isFuture = diffMs < 0;

  if (absDiff < 60_000) {
    const s = Math.round(absDiff / 1000);
    return isFuture ? `in ${s}s` : `${s}s ago`;
  }
  if (absDiff < 3_600_000) {
    const m = Math.round(absDiff / 60_000);
    return isFuture ? `in ${m}m` : `${m}m ago`;
  }
  if (absDiff < 86_400_000) {
    const h = Math.round(absDiff / 3_600_000);
    return isFuture ? `in ${h}h` : `${h}h ago`;
  }
  const d = Math.round(absDiff / 86_400_000);
  return isFuture ? `in ${d}d` : `${d}d ago`;
}

function durationMs(start: string, end?: string): string | null {
  if (!end) return null;
  const d = new Date(end).getTime() - new Date(start).getTime();
  if (isNaN(d) || d < 0) return null;
  if (d < 1000) return `${d}ms`;
  if (d < 60_000) return `${(d / 1000).toFixed(1)}s`;
  return `${(d / 60_000).toFixed(1)}m`;
}

const SCHEDULE_PRESETS = [
  { label: "Every minute", value: "* * * * *" },
  { label: "Every 5 minutes", value: "*/5 * * * *" },
  { label: "Every 15 minutes", value: "*/15 * * * *" },
  { label: "Every 30 minutes", value: "*/30 * * * *" },
  { label: "Hourly", value: "0 * * * *" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Daily at midnight", value: "0 0 * * *" },
  { label: "Daily at 9 AM", value: "0 9 * * *" },
  { label: "Weekly (Sunday)", value: "0 0 * * 0" },
  { label: "Monthly (1st)", value: "0 0 1 * *" },
];

type StatusFilter = "all" | "enabled" | "disabled";
type ResultFilter = "all" | "success" | "error";

// ── Result Badge ─────────────────────────────────────────────────────────────

function ResultBadge({ result }: { result?: string }) {
  if (!result) return null;

  const variants: Record<string, { className: string; icon: React.ReactNode }> = {
    success: {
      className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/25",
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    error: {
      className: "bg-red-500/15 text-red-600 border-red-500/25",
      icon: <XCircle className="w-3 h-3" />,
    },
    running: {
      className: "bg-yellow-500/15 text-yellow-600 border-yellow-500/25",
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
    },
  };

  const v = variants[result] ?? {
    className: "bg-muted text-muted-foreground",
    icon: null,
  };

  return (
    <Badge variant="outline" className={`text-xs gap-1 ${v.className}`}>
      {v.icon}
      {result}
    </Badge>
  );
}

// ── Run History Row ──────────────────────────────────────────────────────────

function RunHistoryRow({ run }: { run: CronRunResult }) {
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-md bg-muted/30 text-sm">
      <ResultBadge result={run.status} />
      <span className="text-xs text-muted-foreground">
        {relativeTime(run.startedAt) ?? run.startedAt}
      </span>
      {run.finishedAt && (
        <span className="text-xs text-muted-foreground">
          {durationMs(run.startedAt, run.finishedAt)}
        </span>
      )}
      <div className="flex-1 min-w-0 text-xs text-muted-foreground font-mono truncate ml-auto max-w-[50%]">
        {run.status === "error" && run.error ? run.error : run.output ?? ""}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function CronPage() {

  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CronJob | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [running, setRunning] = useState<Record<string, boolean>>({});

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");

  // Run history
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [runHistory, setRunHistory] = useState<Record<string, CronRunResult[]>>({});
  const [historyLoading, setHistoryLoading] = useState<Record<string, boolean>>({});

  // Add job form
  const [newName, setNewName] = useState("");
  const [newExpr, setNewExpr] = useState("");
  const [newCmd, setNewCmd] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchJobs = useCallback(async () => {
    try {
      const result = await api.rpc("cron.list");
      setJobs(result?.jobs ?? []);
    } catch {
      toast.error("Failed to load cron jobs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEvent("cron", () => {
    fetchJobs();
  });

  // Fetch run history for a job
  const fetchRunHistory = useCallback(
    async (jobId: string) => {
      setHistoryLoading((p) => ({ ...p, [jobId]: true }));
      try {
        const result = await api.rpc("cron.runs", { id: jobId, limit: 5 });
        setRunHistory((p) => ({ ...p, [jobId]: result?.entries ?? [] }));
      } catch {
        toast.error("Failed to load run history");
      } finally {
        setHistoryLoading((p) => ({ ...p, [jobId]: false }));
      }
    },
    []
  );

  const toggleHistory = useCallback(
    (jobId: string) => {
      if (expandedJob === jobId) {
        setExpandedJob(null);
      } else {
        setExpandedJob(jobId);
        if (!runHistory[jobId]) {
          fetchRunHistory(jobId);
        }
      }
    },
    [expandedJob, runHistory, fetchRunHistory]
  );

  // Stats
  const stats = useMemo(() => {
    const total = jobs.length;
    const enabled = jobs.filter((j) => j.enabled).length;
    const disabled = total - enabled;
    const errors = jobs.filter((j) => j.lastResult === "error").length;
    return { total, enabled, disabled, errors };
  }, [jobs]);

  // Filtered jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !job.name.toLowerCase().includes(q) &&
          !job.command.toLowerCase().includes(q) &&
          !job.expression.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (statusFilter === "enabled" && !job.enabled) return false;
      if (statusFilter === "disabled" && job.enabled) return false;
      if (resultFilter === "success" && job.lastResult !== "success") return false;
      if (resultFilter === "error" && job.lastResult !== "error") return false;
      return true;
    });
  }, [jobs, search, statusFilter, resultFilter]);

  const handleToggle = async (job: CronJob, enabled: boolean) => {
    try {
      await api.rpc("cron.update", { id: job.id, enabled });
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
      const result = await api.rpc("cron.run", { id: job.id });
      if (result.status === "error") {
        toast.error(`Job failed: ${result.error || "Unknown error"}`);
      } else {
        toast.success(`Job "${job.name}" executed`);
      }
      fetchJobs();
      // Refresh history if expanded
      if (expandedJob === job.id) {
        fetchRunHistory(job.id);
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
      await api.rpc("cron.add", {
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
      await api.rpc("cron.remove", { id: deleteTarget.id });
      toast.success(`Job "${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
      fetchJobs();
    } catch {
      toast.error("Failed to delete job");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
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

      {/* Stats Bar */}
      {!loading && jobs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <div className="rounded-md bg-primary/10 p-2">
                <BarChart3 className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-xs text-muted-foreground">Total Jobs</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <div className="rounded-md bg-emerald-500/10 p-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.enabled}</div>
                <div className="text-xs text-muted-foreground">Enabled</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <div className="rounded-md bg-muted p-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.disabled}</div>
                <div className="text-xs text-muted-foreground">Disabled</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <div className="rounded-md bg-red-500/10 p-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.errors}</div>
                <div className="text-xs text-muted-foreground">Last Errors</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      {!loading && jobs.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v: string) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="enabled">Enabled</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={resultFilter}
            onValueChange={(v: string) => setResultFilter(v as ResultFilter)}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Result" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Results</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Jobs List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="py-4">
                <Skeleton className="h-5 w-full max-w-md mb-2" />
                <Skeleton className="h-4 w-48" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Clock className="w-16 h-16 mb-4 opacity-20" />
          <p className="text-sm">No cron jobs configured. Add one to get started.</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Search className="w-12 h-12 mb-3 opacity-20" />
          <p className="text-sm">No jobs match your filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredJobs.map((job) => {
            const isExpanded = expandedJob === job.id;
            const history = runHistory[job.id];
            const isLoadingHistory = historyLoading[job.id];

            return (
              <Card
                key={job.id}
                className={`transition-colors ${isExpanded ? "ring-1 ring-primary/20" : "hover:bg-accent/30"}`}
              >
                <CardContent className="py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Toggle */}
                    <div className="flex items-center gap-3 shrink-0">
                      <Switch
                        checked={job.enabled}
                        onCheckedChange={(checked: boolean) =>
                          handleToggle(job, checked)
                        }
                      />
                    </div>

                    {/* Job Info */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{job.name}</span>
                        <Badge
                          variant="outline"
                          className="text-xs font-mono shrink-0"
                        >
                          {job.expression}
                        </Badge>
                        {!job.enabled && (
                          <Badge variant="secondary" className="text-xs">
                            Disabled
                          </Badge>
                        )}
                        <ResultBadge result={job.lastResult} />
                      </div>
                      <div className="text-xs text-muted-foreground font-mono truncate">
                        {job.command}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {job.lastRun && (
                          <span className="flex items-center gap-1">
                            <Timer className="w-3 h-3" />
                            Last: {relativeTime(job.lastRun) ?? job.lastRun}
                          </span>
                        )}
                        {job.nextRun && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Next: {relativeTime(job.nextRun) ?? job.nextRun}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleHistory(job.id)}
                        title="Run History"
                        className="text-muted-foreground"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRun(job)}
                        disabled={running[job.id]}
                        title="Run Now"
                      >
                        {running[job.id] ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
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

                  {/* Run History (expanded) */}
                  {isExpanded && (
                    <div className="mt-4 pt-3 border-t space-y-2">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Recent Runs
                      </div>
                      {isLoadingHistory ? (
                        <div className="space-y-2">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-8 w-full" />
                          ))}
                        </div>
                      ) : !history || history.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">
                          No run history available.
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {history.map((run) => (
                            <RunHistoryRow key={run.id} run={run} />
                          ))}
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => fetchRunHistory(job.id)}
                        disabled={isLoadingHistory}
                      >
                        {isLoadingHistory ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : null}
                        Refresh
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
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
              <Label htmlFor="cron-expr">Schedule</Label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {SCHEDULE_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setNewExpr(preset.value)}
                    className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                      newExpr === preset.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <Input
                id="cron-expr"
                placeholder="*/5 * * * *"
                className="font-mono"
                value={newExpr}
                onChange={(e) => setNewExpr(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Standard cron syntax: minute hour day month weekday
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
              <p className="text-xs text-muted-foreground">
                The command or message the agent will execute on schedule.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                creating || !newName.trim() || !newExpr.trim() || !newCmd.trim()
              }
            >
              {creating ? "Creating..." : "Create Job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Job</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;?
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
