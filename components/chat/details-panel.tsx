"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGatewaySSEStore } from "@/stores/gateway-sse";
import { api } from "@/lib/api-client";
import { useChatStore } from "@/stores/chat";
import type { ChatMessage, MessageMetadata } from "@/stores/chat";
import type { SessionSummary } from "@/lib/types";
import { Bot, Hash, Zap, ChevronDown, ChevronRight } from "lucide-react";

function ToolCallItem({ call }: { call: NonNullable<MessageMetadata["toolCalls"]>[number] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs bg-muted/30 hover:bg-muted/60 transition-colors text-left"
      >
        {open ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
        <span className="font-mono font-medium text-primary">{call.name}</span>
        {call.startedAt && (
          <span className="ml-auto text-muted-foreground">
            {new Date(call.startedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        )}
      </button>
      {open && (
        <div className="px-3 py-2 space-y-2 bg-background">
          {call.input !== undefined && (
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Input</div>
              <pre className="text-xs font-mono bg-muted/40 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(call.input, null, 2)}
              </pre>
            </div>
          )}
          {call.output !== undefined && (
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Output</div>
              <pre className="text-xs font-mono bg-muted/40 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                {typeof call.output === "string" ? call.output : JSON.stringify(call.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs text-right font-medium break-all">{value}</span>
    </div>
  );
}

interface DetailsPanelProps {
  open: boolean;
  onClose: () => void;
  sessionKey: string | null;
  focusedMessage?: ChatMessage | null;
  allMessages: ChatMessage[];
}

export function DetailsPanel({
  open,
  onClose,
  sessionKey,
  focusedMessage,
  allMessages,
}: DetailsPanelProps) {
  const isConnected = useGatewaySSEStore((s) => s.gatewayConnected);
  const sessionUsage = useChatStore((s) => s.sessionUsage);
  const sessionModel = useChatStore((s) => s.sessionModel);
  const [session, setSession] = useState<SessionSummary | null>(null);
  const [activeTab, setActiveTab] = useState("session");

  useEffect(() => {
    if (!open || !sessionKey || !isConnected) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await api.rpc("sessions.list", { limit: 500 });
        const found = (result?.sessions ?? []).find((s) => s.key === sessionKey);
        if (!cancelled && found) setSession(found);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [open, sessionKey, isConnected, allMessages.length]);

  useEffect(() => {
    if (focusedMessage) setActiveTab("raw");
  }, [focusedMessage]);

  // Use session-level usage (from sessions.usage RPC) with per-message fallback
  const msgInput = allMessages.reduce((sum, m) => sum + (m.metadata?.inputTokens ?? 0), 0);
  const msgOutput = allMessages.reduce((sum, m) => sum + (m.metadata?.outputTokens ?? 0), 0);
  const totalInput = sessionUsage?.inputTokens || msgInput || (session?.inputTokens ?? 0);
  const totalOutput = sessionUsage?.outputTokens || msgOutput || (session?.outputTokens ?? 0);
  const totalCost = sessionUsage?.totalCost ?? 0;
  const allToolCalls = allMessages.flatMap((m) => m.metadata?.toolCalls ?? []);

  const lastModel = [...allMessages].reverse().find(m => m.role === "assistant" && m.metadata?.model)?.metadata?.model;

  const rawTarget =
    focusedMessage ??
    [...allMessages].reverse().find((m) => m.role === "assistant" && m.metadata?.rawEvent);

  function formatRelativeTime(ts?: number): string {
    if (!ts) return "—";
    const diff = Date.now() - ts;
    if (diff < 60_000) return "Just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return new Date(ts).toLocaleDateString();
  }

  return (
    <Sheet open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <SheetContent side="right" className="w-80 sm:w-96 p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b border-border shrink-0">
          <SheetTitle className="text-sm">Session Details</SheetTitle>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full rounded-none border-b border-border bg-transparent h-9 shrink-0">
            <TabsTrigger value="session" className="flex-1 text-xs h-full rounded-none">Session</TabsTrigger>
            <TabsTrigger value="tokens" className="flex-1 text-xs h-full rounded-none">Tokens</TabsTrigger>

            <TabsTrigger value="tools" className="flex-1 text-xs h-full rounded-none">
              Tools {allToolCalls.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] px-1">{allToolCalls.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="raw" className="flex-1 text-xs h-full rounded-none">Raw</TabsTrigger>
          </TabsList>

          <TabsContent value="session" className="flex-1 overflow-hidden mt-0">
            <ScrollArea className="h-full">
              <div className="px-4 py-3 space-y-1">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{session?.displayName ?? "Session"}</div>
                    <div className="text-xs text-muted-foreground">{session?.channel ?? "—"}</div>
                  </div>
                </div>
                <Separator />
                <InfoRow label="Agent" value={session?.agentId} />
                <InfoRow label="Model" value={sessionModel ?? sessionUsage?.model ?? session?.model ?? lastModel} />
                <InfoRow label="Channel" value={session?.channel} />
                <InfoRow label="Kind" value={session?.kind} />
                <InfoRow
                  label="Key"
                  value={
                    <span className="font-mono text-[10px] opacity-60 break-all">
                      {sessionKey}
                    </span>
                  }
                />
                <InfoRow label="Last activity" value={formatRelativeTime(session?.updatedAt)} />
                <Separator className="my-2" />
                <InfoRow label="Input tokens" value={totalInput > 0 ? totalInput.toLocaleString() : session?.inputTokens?.toLocaleString()} />
                <InfoRow label="Output tokens" value={totalOutput > 0 ? totalOutput.toLocaleString() : session?.outputTokens?.toLocaleString()} />
                <InfoRow label="Total tokens" value={(totalInput + totalOutput) > 0 ? (totalInput + totalOutput).toLocaleString() : session?.totalTokens?.toLocaleString()} />
                {totalCost > 0 && <InfoRow label="Cost" value={`$${totalCost.toFixed(4)}`} />}
                {sessionUsage?.modelProvider && <InfoRow label="Provider" value={sessionUsage.modelProvider} />}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="tokens" className="flex-1 overflow-hidden mt-0">
            <ScrollArea className="h-full">
              <div className="px-4 py-3 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/40 rounded-lg p-3 space-y-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Zap className="w-3 h-3" /> Input
                    </div>
                    <div className="text-lg font-bold">{totalInput.toLocaleString()}</div>
                    <div className="text-[10px] text-muted-foreground">tokens</div>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3 space-y-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Hash className="w-3 h-3" /> Output
                    </div>
                    <div className="text-lg font-bold">{totalOutput.toLocaleString()}</div>
                    <div className="text-[10px] text-muted-foreground">tokens</div>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-2">Per message</div>
                  <div className="space-y-1">
                    {allMessages
                      .filter((m) => m.metadata?.inputTokens || m.metadata?.outputTokens)
                      .map((m) => (
                        <div key={m.id} className="flex items-center gap-2 text-xs py-1">
                          <span className="text-muted-foreground/60 shrink-0 text-[10px]">
                            {new Date(m.timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <span className="text-muted-foreground truncate flex-1">
                            {m.metadata?.model ?? "—"}
                          </span>
                          <span className="text-muted-foreground/80 shrink-0">
                            {((m.metadata?.inputTokens ?? 0) + (m.metadata?.outputTokens ?? 0)).toLocaleString()}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="tools" className="flex-1 overflow-hidden mt-0">
            <ScrollArea className="h-full">
              <div className="px-4 py-3 space-y-2">
                {allToolCalls.length === 0 ? (
                  <div className="text-xs text-muted-foreground text-center py-8">
                    No tool calls in this session
                  </div>
                ) : (
                  allToolCalls.map((call, i) => (
                    <ToolCallItem key={call.id ?? i} call={call} />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="raw" className="flex-1 overflow-hidden mt-0">
            <ScrollArea className="h-full">
              <div className="px-4 py-3">
                {rawTarget?.metadata?.rawEvent ? (
                  <pre className="text-[10px] font-mono bg-muted/40 rounded p-3 overflow-x-auto whitespace-pre-wrap break-all border border-border">
                    {JSON.stringify(rawTarget.metadata.rawEvent, null, 2)}
                  </pre>
                ) : (
                  <div className="text-xs text-muted-foreground text-center py-8">
                    No raw event available.<br />
                    <span className="text-[10px]">Click a model chip on a message to view its raw data.</span>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
