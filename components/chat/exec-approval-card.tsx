"use client";

import { useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { useNotificationStore } from "@/stores/notifications";
import { Shield, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ExecApprovalCardProps {
  approvalId: string;
  command?: string;
  agentId?: string;
  sessionKey?: string;
}

export function ExecApprovalCard({ approvalId, command, agentId }: ExecApprovalCardProps) {
  const removeApproval = useNotificationStore((s) => s.removeApproval);
  const [state, setState] = useState<"pending" | "resolving" | "approved" | "denied">("pending");

  const resolve = useCallback(async (allow: boolean) => {
    setState("resolving");
    try {
      await api.rpc("exec.approval.resolve", { id: approvalId, approved: allow });
      setState(allow ? "approved" : "denied");
      removeApproval(approvalId);
      toast.success(allow ? "Execution approved" : "Execution denied");
    } catch (err) {
      setState("pending");
      toast.error("Failed to resolve approval");
    }
  }, [approvalId, removeApproval]);

  const isResolved = state === "approved" || state === "denied";

  return (
    <div className={`my-2 rounded-lg border overflow-hidden ${
      isResolved
        ? state === "approved"
          ? "border-green-500/20 bg-green-500/5"
          : "border-destructive/20 bg-destructive/5"
        : "border-amber-500/20 bg-amber-500/5"
    }`}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30">
        <Shield className="w-3.5 h-3.5 text-amber-500" />
        <span className="text-xs font-medium">Execution Approval Required</span>
        {agentId && <span className="text-[10px] text-muted-foreground ml-auto">{agentId}</span>}
      </div>
      {command && (
        <div className="px-3 py-2">
          <pre className="text-xs font-mono bg-background/60 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
            {command}
          </pre>
        </div>
      )}
      <div className="px-3 py-2 flex items-center gap-2">
        {state === "pending" && (
          <>
            <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={() => resolve(true)}>
              <Check className="w-3 h-3" /> Allow
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => resolve(false)}>
              <X className="w-3 h-3" /> Deny
            </Button>
          </>
        )}
        {state === "resolving" && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" /> Resolving...
          </div>
        )}
        {state === "approved" && (
          <span className="text-xs text-green-500 flex items-center gap-1"><Check className="w-3 h-3" /> Approved</span>
        )}
        {state === "denied" && (
          <span className="text-xs text-destructive flex items-center gap-1"><X className="w-3 h-3" /> Denied</span>
        )}
      </div>
    </div>
  );
}
