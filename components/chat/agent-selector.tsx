"use client";

import { useEffect, useState, useCallback } from "react";
import { useGatewayStore } from "@/stores/gateway";
import type { AgentSummary } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Star, Loader2 } from "lucide-react";

interface AgentSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (agentId: string) => void;
}

export function AgentSelector({ open, onClose, onSelect }: AgentSelectorProps) {
  const rpc = useGatewayStore((s) => s.rpc);
  const isConnected = useGatewayStore((s) => s.state === "connected");
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [defaultId, setDefaultId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const loadAgents = useCallback(async () => {
    if (!isConnected) return;
    setLoading(true);
    try {
      const result = await rpc("agents.list");
      if (result && typeof result === "object") {
        setAgents(result.agents ?? []);
        setDefaultId(result.defaultId ?? "");
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [rpc, isConnected]);

  useEffect(() => {
    if (open && isConnected) {
      loadAgents();
    }
  }, [open, isConnected, loadAgents]);

  const handleSelect = useCallback(
    (agentId: string) => {
      onSelect(agentId);
    },
    [onSelect]
  );

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start New Chat</DialogTitle>
          <DialogDescription>
            Select an agent to start a new conversation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[400px] overflow-y-auto py-2">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-8">
              <Bot className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">
                {isConnected
                  ? "No agents available"
                  : "Connect to gateway to see agents"}
              </p>
            </div>
          ) : (
            agents.map((agent) => {
              const isDefault = agent.id === defaultId;
              const displayName =
                agent.identity?.name ?? agent.name ?? agent.id;
              const emoji = agent.identity?.emoji;

              return (
                <button
                  key={agent.id}
                  onClick={() => handleSelect(agent.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors hover:bg-accent/50 text-left ${
                    isDefault
                      ? "border-primary/30 bg-primary/5"
                      : "border-border"
                  }`}
                >
                  {/* Agent avatar */}
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg shrink-0">
                    {emoji || <Bot className="w-5 h-5" />}
                  </div>

                  {/* Agent info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {displayName}
                      </span>
                      {isDefault && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-primary font-medium">
                          <Star className="w-3 h-3 fill-current" />
                          Default
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      {agent.id}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
