"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { api } from "@/lib/api-client";
import { useEvent } from "@/hooks/use-event";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShieldCheck,
  ShieldAlert,
  Check,
  CheckCheck,
  X,
  Terminal,
  Clock,
  FolderOpen,
  Server,
  User,
  Key,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Volume2,
  Shield,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import type { ExecApprovalEvent, ExecApprovalSettings } from "@/lib/types";

// ─── Types ───────────────────────────────────────────────────────────────────

type ResolvedApproval = ExecApprovalEvent & {
  decision: "allow-once" | "allow-always" | "deny";
  resolvedBy?: string;
  resolvedAtMs: number;
};

type Decision = "allow-once" | "allow-always" | "deny";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(ts?: number): string {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatCountdown(expiresAtMs: number): string {
  const remaining = Math.max(0, expiresAtMs - Date.now());
  if (remaining <= 0) return "Expired";
  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${seconds}s`;
}

function getCountdownColor(expiresAtMs: number): string {
  const remaining = expiresAtMs - Date.now();
  if (remaining <= 0) return "text-destructive";
  if (remaining < 10_000) return "text-destructive";
  if (remaining < 30_000) return "text-amber-500";
  return "text-muted-foreground";
}

function getDecisionBadge(decision: Decision) {
  switch (decision) {
    case "allow-once":
      return (
        <Badge className="bg-emerald-600 text-white border-emerald-700">
          <Check className="w-3 h-3" />
          Allowed Once
        </Badge>
      );
    case "allow-always":
      return (
        <Badge className="bg-blue-600 text-white border-blue-700">
          <CheckCheck className="w-3 h-3" />
          Allowed Always
        </Badge>
      );
    case "deny":
      return (
        <Badge variant="destructive">
          <X className="w-3 h-3" />
          Denied
        </Badge>
      );
  }
}

// ─── Countdown Timer Hook ────────────────────────────────────────────────────

function useCountdownTick(hasPending: boolean) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!hasPending) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [hasPending]);
  return tick;
}

// ─── Notification Sound ──────────────────────────────────────────────────────

function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.setValueAtTime(800, ctx.currentTime);
    oscillator.frequency.setValueAtTime(600, ctx.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(800, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.4);
  } catch {
    // Audio not available, ignore
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ApprovalsPage() {

  // Pending approvals (real-time from events)
  const [pending, setPending] = useState<ExecApprovalEvent[]>([]);
  // Resolved approvals (local history)
  const [resolved, setResolved] = useState<ResolvedApproval[]>([]);
  // Button loading states
  const [resolving, setResolving] = useState<Record<string, Decision | null>>(
    {}
  );

  // Security settings
  const [settings, setSettings] = useState<ExecApprovalSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Sound notification toggle
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Visual flash state for new approvals
  const [flashId, setFlashId] = useState<string | null>(null);

  // Countdown tick
  useCountdownTick(pending.length > 0);

  // Track if we've loaded once
  const initialLoadDone = useRef(false);

  // ─── Fetch security settings ───────────────────────────────────────────

  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const result = await api.rpc("exec.approvals.get");
      setSettings(result);
    } catch {
      // Silently fail
    } finally {
      setSettingsLoading(false);
      initialLoadDone.current = true;
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // ─── Listen for real-time events ───────────────────────────────────────

  useEvent("exec.approval.requested", (event) => {
    setPending((prev) => {
      if (prev.some((p) => p.id === event.id)) return prev;
      return [event, ...prev];
    });

    // Flash animation
    setFlashId(event.id);
    setTimeout(() => setFlashId(null), 2000);

    // Sound notification
    if (soundEnabled) {
      playNotificationSound();
    }

    // Browser notification if tab is not focused
    if (document.hidden && "Notification" in window) {
      if (Notification.permission === "granted") {
        new Notification("Execution Approval Required", {
          body: event.command || event.request?.command || "Command approval needed",
          icon: "/favicon.ico",
        });
      }
    }
  });

  useEvent("exec.approval.resolved", (event) => {
    // Move from pending to resolved
    setPending((prev) => {
      const found = prev.find((p) => p.id === event.id);
      if (found) {
        setResolved((r) => [
          {
            ...found,
            decision: event.approved ? "allow-once" : "deny",
            resolvedAtMs: Date.now(),
          },
          ...r,
        ]);
      }
      return prev.filter((p) => p.id !== event.id);
    });
  });

  // ─── Auto-remove expired approvals ─────────────────────────────────────

  useEffect(() => {
    if (pending.length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setPending((prev) => {
        const expired = prev.filter(
          (p) => p.expiresAtMs && p.expiresAtMs < now
        );
        if (expired.length === 0) return prev;
        // Move expired to resolved
        setResolved((r) => [
          ...expired.map((p) => ({
            ...p,
            decision: "deny" as Decision,
            resolvedAtMs: now,
          })),
          ...r,
        ]);
        return prev.filter((p) => !p.expiresAtMs || p.expiresAtMs >= now);
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [pending.length]);

  // ─── Resolve handler ───────────────────────────────────────────────────

  const handleResolve = useCallback(
    async (id: string, decision: Decision) => {
      setResolving((prev) => ({ ...prev, [id]: decision }));
      try {
        const approved = decision !== "deny";
        await api.rpc("exec.approval.resolve", { id, approved });

        // Move from pending to resolved locally
        setPending((prev) => {
          const found = prev.find((p) => p.id === id);
          if (found) {
            setResolved((r) => [
              {
                ...found,
                decision,
                resolvedAtMs: Date.now(),
              },
              ...r,
            ]);
          }
          return prev.filter((p) => p.id !== id);
        });

        const label =
          decision === "allow-once"
            ? "Allowed once"
            : decision === "allow-always"
            ? "Allowed always"
            : "Denied";
        toast.success(label);
      } catch {
        toast.error("Failed to resolve approval");
      } finally {
        setResolving((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    },
    []
  );

  // ─── Save settings ────────────────────────────────────────────────────

  const handleSaveSettings = useCallback(
    async (patch: Partial<ExecApprovalSettings>) => {
      setSettingsSaving(true);
      try {
        await api.rpc("exec.approvals.set", patch);
        toast.success("Security settings updated");
        fetchSettings();
      } catch {
        toast.error("Failed to update settings");
      } finally {
        setSettingsSaving(false);
      }
    },
    [fetchSettings]
  );

  // ─── Request notification permission on mount ──────────────────────────

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Execution Approvals</h1>
            {pending.length > 0 && (
              <Badge className="bg-orange-500 text-white animate-pulse">
                <ShieldAlert className="w-3 h-3" />
                {pending.length} pending
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Review and approve or deny agent command executions. This is a
            security-critical feature.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className={soundEnabled ? "text-primary" : "text-muted-foreground"}
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={
              soundEnabled
                ? "Sound notifications enabled"
                : "Sound notifications disabled"
            }
          >
            <Volume2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Pending Approvals */}
      {pending.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <ShieldCheck className="w-16 h-16 mb-4 opacity-20" />
            <h2 className="text-lg font-medium mb-1">
              No Pending Approvals
            </h2>
            <p className="text-sm text-center max-w-md">
              When an agent requests to execute a command, it will appear here
              for your review. All clear for now.
            </p>
            <p className="text-xs mt-3 text-muted-foreground/60">
              Listening for exec.approval.requested events...
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Pending Approvals
          </h2>
          <div className="space-y-3">
            {pending.map((approval) => {
              const cmd =
                approval.command || approval.request?.command || "Unknown command";
              const cwd = approval.request?.cwd;
              const host = approval.request?.host;
              const security = approval.request?.security;
              const agentId =
                approval.agentId || approval.request?.agentId;
              const sessionKey =
                approval.sessionKey || approval.request?.sessionKey;
              const createdAt =
                approval.createdAtMs || approval.timestamp;
              const expiresAt = approval.expiresAtMs;
              const isExpiring =
                expiresAt && expiresAt - Date.now() < 30_000;
              const isResolving = resolving[approval.id];

              return (
                <Card
                  key={approval.id}
                  className={`border-orange-500/40 transition-all ${
                    flashId === approval.id
                      ? "ring-2 ring-orange-500 shadow-lg shadow-orange-500/20"
                      : ""
                  } ${
                    isExpiring
                      ? "border-destructive/50 shadow-sm shadow-destructive/10"
                      : ""
                  }`}
                >
                  <CardHeader className="pb-0">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-orange-400" />
                      <span className="text-sm font-medium">
                        Execution Approval Required
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto flex items-center gap-2">
                        {createdAt && (
                          <span>{formatTime(createdAt)}</span>
                        )}
                        {expiresAt && (
                          <span
                            className={`font-mono font-semibold ${getCountdownColor(
                              expiresAt
                            )}`}
                          >
                            <Clock className="w-3 h-3 inline mr-0.5" />
                            {formatCountdown(expiresAt)}
                          </span>
                        )}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-3">
                    {/* Command */}
                    <div className="bg-zinc-950 rounded-lg p-4 font-mono text-sm text-emerald-400 break-all border border-zinc-800">
                      <span className="text-zinc-500 select-none">$ </span>
                      {cmd}
                    </div>

                    {/* Metadata grid */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      {agentId && (
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">Agent</span>
                          <span className="ml-auto font-mono text-xs truncate max-w-[140px]">
                            {agentId}
                          </span>
                        </div>
                      )}
                      {sessionKey && (
                        <div className="flex items-center gap-2">
                          <Key className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            Session
                          </span>
                          <span className="ml-auto font-mono text-xs truncate max-w-[140px]">
                            {sessionKey}
                          </span>
                        </div>
                      )}
                      {cwd && (
                        <div className="flex items-center gap-2">
                          <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            Directory
                          </span>
                          <span className="ml-auto font-mono text-xs truncate max-w-[140px]">
                            {cwd}
                          </span>
                        </div>
                      )}
                      {host && (
                        <div className="flex items-center gap-2">
                          <Server className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">Host</span>
                          <span className="ml-auto text-xs">{host}</span>
                        </div>
                      )}
                      {security && (
                        <div className="flex items-center gap-2">
                          <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            Security
                          </span>
                          <Badge
                            variant="outline"
                            className="ml-auto text-[10px] px-1.5 py-0"
                          >
                            {security}
                          </Badge>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">ID</span>
                        <span className="ml-auto font-mono text-xs truncate max-w-[140px]">
                          {approval.id}
                        </span>
                      </div>
                    </div>

                    {/* Expiry warning */}
                    {isExpiring && (
                      <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>
                          This approval will expire soon. Act quickly.
                        </span>
                      </div>
                    )}

                    {/* Action buttons */}
                    <Separator />
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() =>
                          handleResolve(approval.id, "allow-once")
                        }
                        disabled={!!isResolving}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        {isResolving === "allow-once" ? (
                          "Allowing..."
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            Allow Once
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          handleResolve(approval.id, "allow-always")
                        }
                        disabled={!!isResolving}
                      >
                        {isResolving === "allow-always" ? (
                          "Allowing..."
                        ) : (
                          <>
                            <CheckCheck className="w-4 h-4" />
                            Allow Always
                          </>
                        )}
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleResolve(approval.id, "deny")}
                        disabled={!!isResolving}
                      >
                        {isResolving === "deny" ? (
                          "Denying..."
                        ) : (
                          <>
                            <X className="w-4 h-4" />
                            Deny
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Resolved History */}
      {resolved.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Recently Resolved
          </h2>
          <div className="space-y-2">
            {resolved.slice(0, 20).map((item) => {
              const cmd =
                item.command || item.request?.command || "Unknown command";
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs truncate text-muted-foreground">
                      {cmd}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {(item.agentId || item.request?.agentId) && (
                        <span>
                          Agent:{" "}
                          <span className="font-mono">
                            {item.agentId || item.request?.agentId}
                          </span>
                        </span>
                      )}
                      <span>{formatTime(item.resolvedAtMs)}</span>
                    </div>
                  </div>
                  {getDecisionBadge(item.decision)}
                </div>
              );
            })}
            {resolved.length > 20 && (
              <p className="text-xs text-center text-muted-foreground py-2">
                Showing 20 of {resolved.length} resolved approvals
              </p>
            )}
          </div>
        </div>
      )}

      {/* Security Settings (collapsible) */}
      <div className="rounded-lg border bg-card">
        <button
          className="flex items-center justify-between w-full px-4 py-3 text-left"
          onClick={() => {
            setSettingsOpen(!settingsOpen);
            if (!settingsOpen && !settings) fetchSettings();
          }}
        >
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Security Settings</span>
          </div>
          {settingsOpen ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {settingsOpen && (
          <div className="px-4 pb-4 space-y-4">
            <Separator />

            {settingsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : settings ? (
              <div className="space-y-4">
                {/* Security Level */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Security Level</Label>
                  <p className="text-xs text-muted-foreground">
                    Determines which commands require approval before execution.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {["off", "permissive", "moderate", "strict"].map(
                      (level) => (
                        <Button
                          key={level}
                          variant={
                            settings.security === level
                              ? "default"
                              : "outline"
                          }
                          size="sm"
                          disabled={settingsSaving}
                          onClick={() =>
                            handleSaveSettings({ security: level })
                          }
                        >
                          {level.charAt(0).toUpperCase() + level.slice(1)}
                        </Button>
                      )
                    )}
                  </div>
                </div>

                {/* Ask Mode */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Ask Mode</Label>
                  <p className="text-xs text-muted-foreground">
                    How the agent should request permission for commands.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {["auto", "always", "never"].map((mode) => (
                      <Button
                        key={mode}
                        variant={
                          settings.ask === mode ? "default" : "outline"
                        }
                        size="sm"
                        disabled={settingsSaving}
                        onClick={() => handleSaveSettings({ ask: mode })}
                      >
                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Ask Fallback */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Ask Fallback</Label>
                  <p className="text-xs text-muted-foreground">
                    What happens when no human is available to approve. Current:{" "}
                    <span className="font-mono">{settings.askFallback}</span>
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {["allow", "deny", "queue"].map((fallback) => (
                      <Button
                        key={fallback}
                        variant={
                          settings.askFallback === fallback
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        disabled={settingsSaving}
                        onClick={() =>
                          handleSaveSettings({ askFallback: fallback })
                        }
                      >
                        {fallback.charAt(0).toUpperCase() + fallback.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Auto Allow Skills */}
                <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">
                      Auto-Allow Skills
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically approve commands from recognized skills.
                    </p>
                  </div>
                  <Switch
                    checked={settings.autoAllowSkills}
                    onCheckedChange={(checked: boolean) =>
                      handleSaveSettings({ autoAllowSkills: checked })
                    }
                    disabled={settingsSaving}
                  />
                </div>

                {/* Current policy summary */}
                <div className="rounded-lg bg-muted/50 border border-dashed px-4 py-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Current Policy Summary
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-xs">
                      <Shield className="w-3 h-3" />
                      {settings.security}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Ask: {settings.ask}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Fallback: {settings.askFallback}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Skills:{" "}
                      {settings.autoAllowSkills ? "auto-allow" : "manual"}
                    </Badge>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Unable to load security settings. The gateway may not support
                this feature.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
