"use client";

import { useState, useCallback } from "react";
import { useGatewayStore } from "@/stores/gateway";
import { useIsConnected } from "@/hooks/use-gateway";
import { useEvent } from "@/hooks/use-event";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Check, X, Terminal, WifiOff } from "lucide-react";
import { toast } from "sonner";
import type { ExecApprovalEvent } from "@/lib/types";

export default function ApprovalsPage() {
  const rpc = useGatewayStore((s) => s.rpc);
  const isConnected = useIsConnected();

  const [pending, setPending] = useState<ExecApprovalEvent[]>([]);
  const [resolving, setResolving] = useState<Record<string, boolean>>({});

  // Listen for new approval requests
  useEvent("exec.approval.requested", (event) => {
    setPending((prev) => {
      // Avoid duplicates
      if (prev.some((p) => p.id === event.id)) return prev;
      return [event, ...prev];
    });
  });

  // Listen for resolved approvals (may be resolved from elsewhere)
  useEvent("exec.approval.resolved", (event) => {
    setPending((prev) => prev.filter((p) => p.id !== event.id));
  });

  const handleResolve = useCallback(
    async (id: string, approved: boolean) => {
      setResolving((prev) => ({ ...prev, [id]: true }));
      try {
        await rpc("exec.approval.resolve", { id, approved });
        setPending((prev) => prev.filter((p) => p.id !== id));
        toast.success(approved ? "Approved" : "Rejected");
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
    [rpc]
  );

  const formatTime = (ts?: number) => {
    if (!ts) return "";
    return new Date(ts).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
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
      <div>
        <h1 className="text-2xl font-bold">Exec Approvals</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Review and approve or reject pending command executions.
          This is a security-critical feature.
        </p>
      </div>

      {pending.length > 0 && (
        <Badge variant="outline" className="text-orange-400 border-orange-400/50">
          {pending.length} pending approval{pending.length !== 1 ? "s" : ""}
        </Badge>
      )}

      {pending.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <ShieldCheck className="w-16 h-16 mb-4 opacity-20" />
          <h2 className="text-lg font-medium mb-1">No Pending Approvals</h2>
          <p className="text-sm">
            When an agent requests to execute a command, it will appear here for your review.
          </p>
          <p className="text-xs mt-2 text-muted-foreground/60">
            Listening for exec.approval.requested events...
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.map((approval) => (
            <Card key={approval.id} className="border-orange-500/30">
              <CardHeader className="pb-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-orange-400" />
                  <span className="text-sm font-medium">Execution Approval Request</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatTime(approval.timestamp)}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Command */}
                {approval.command && (
                  <div className="bg-muted/50 rounded-md p-3 font-mono text-sm break-all">
                    {approval.command}
                  </div>
                )}

                {/* Metadata */}
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                  {approval.agentId && (
                    <span>
                      Agent: <span className="text-foreground">{approval.agentId}</span>
                    </span>
                  )}
                  {approval.sessionKey && (
                    <span>
                      Session: <span className="text-foreground font-mono">{approval.sessionKey}</span>
                    </span>
                  )}
                  <span>
                    ID: <span className="font-mono">{approval.id}</span>
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleResolve(approval.id, true)}
                    disabled={resolving[approval.id]}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Check className="w-4 h-4" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleResolve(approval.id, false)}
                    disabled={resolving[approval.id]}
                  >
                    <X className="w-4 h-4" />
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
