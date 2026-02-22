"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useGatewaySSEStore } from "@/stores/gateway-sse";
import { api } from "@/lib/api-client";
import { useChatStore } from "@/stores/chat";
import type { ChatMessage } from "@/stores/chat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, Cpu, Hash, PanelRight, Search, Zap, Download, FileText, FileJson, FileType, Gauge } from "lucide-react";
import { getModelColor, getShortModelName, getContextPercent, estimateCost } from "@/lib/model-utils";

function parseSessionKey(key: string) {
  const parts = key.split(":");
  const channel = parts[0] ?? "";
  const id = parts.slice(1).join(":") || key;
  return { channel, id };
}

function channelLabel(channel: string): string {
  const ch = channel.toLowerCase();
  if (ch.includes("telegram")) return "Telegram";
  if (ch.includes("whatsapp")) return "WhatsApp";
  if (ch.includes("discord")) return "Discord";
  if (ch.includes("slack")) return "Slack";
  if (ch.includes("webchat")) return "Web Chat";
  return channel || "Unknown";
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

/* ── Export helpers ───────────────────────────────────────────────────── */

function sanitizeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportAsMarkdown(messages: ChatMessage[], sessionKey: string) {
  const lines: string[] = [`# Chat Export: ${sessionKey}`, `Exported: ${new Date().toISOString()}`, ""];
  for (const m of messages) {
    const role = m.role === "user" ? "User" : "Assistant";
    const ts = new Date(m.timestamp).toLocaleString();
    lines.push(`### ${role} — ${ts}`);
    lines.push("");
    lines.push(m.content || "(empty)");
    lines.push("");
  }
  downloadBlob(lines.join("\n"), `chat-${sanitizeFilename(sessionKey)}.md`, "text/markdown");
}

function exportAsJSON(messages: ChatMessage[], sessionKey: string) {
  const data = {
    sessionKey,
    exportedAt: new Date().toISOString(),
    messageCount: messages.length,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
      state: m.state,
      metadata: m.metadata ? {
        model: m.metadata.model,
        provider: m.metadata.provider,
        inputTokens: m.metadata.inputTokens,
        outputTokens: m.metadata.outputTokens,
        cost: m.metadata.cost,
      } : undefined,
    })),
  };
  downloadBlob(JSON.stringify(data, null, 2), `chat-${sanitizeFilename(sessionKey)}.json`, "application/json");
}

function exportAsText(messages: ChatMessage[], sessionKey: string) {
  const lines: string[] = [`Chat: ${sessionKey}`, `Exported: ${new Date().toISOString()}`, "---", ""];
  for (const m of messages) {
    const role = m.role === "user" ? "User" : "Assistant";
    const ts = new Date(m.timestamp).toLocaleString();
    lines.push(`[${ts}] ${role}:`);
    lines.push(m.content || "(empty)");
    lines.push("");
  }
  downloadBlob(lines.join("\n"), `chat-${sanitizeFilename(sessionKey)}.txt`, "text/plain");
}

/* ── ExportMenu ──────────────────────────────────────────────────────── */

function ExportMenu({ messages, sessionKey }: { messages: ChatMessage[]; sessionKey: string }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen((v) => !v)}
        title="Export chat"
      >
        <Download className="w-4 h-4" />
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border border-border bg-popover shadow-lg py-1">
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent transition-colors text-left"
            onClick={() => { exportAsMarkdown(messages, sessionKey); setOpen(false); }}
          >
            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
            Export as Markdown
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent transition-colors text-left"
            onClick={() => { exportAsJSON(messages, sessionKey); setOpen(false); }}
          >
            <FileJson className="w-3.5 h-3.5 text-muted-foreground" />
            Export as JSON
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent transition-colors text-left"
            onClick={() => { exportAsText(messages, sessionKey); setOpen(false); }}
          >
            <FileType className="w-3.5 h-3.5 text-muted-foreground" />
            Export as Text
          </button>
        </div>
      )}
    </div>
  );
}

/* ── ChatHeader ──────────────────────────────────────────────────────── */

interface ChatHeaderProps {
  sessionKey: string;
  detailsOpen: boolean;
  searchOpen: boolean;
  onToggleDetails: () => void;
  onToggleSearch: () => void;
  messages?: ChatMessage[];
}

export function ChatHeader({
  sessionKey,
  detailsOpen,
  searchOpen,
  onToggleDetails,
  onToggleSearch,
  messages = [],
}: ChatHeaderProps) {
  const isConnected = useGatewaySSEStore((s) => s.gatewayConnected);
  const sessionModel = useChatStore((s) => s.sessionModel);
  const sessionUsage = useChatStore((s) => s.sessionUsage);
  const [agentId, setAgentId] = useState<string | null>(null);

  const { channel, id } = parseSessionKey(sessionKey);

  useEffect(() => {
    if (!isConnected || !sessionKey) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await api.rpc("sessions.resolve", { key: sessionKey });
        if (!cancelled && result?.agentId) setAgentId(result.agentId);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [isConnected, sessionKey]);

  const effectiveModel = sessionModel ?? sessionUsage?.model;
  const totalTokens = sessionUsage?.totalTokens ?? 0;
  const cost = sessionUsage?.totalCost ?? 0;
  const modelColor = getModelColor(effectiveModel);
  const shortModel = getShortModelName(effectiveModel);
  const ctxPercent = getContextPercent(effectiveModel, totalTokens);

  // Estimated cost fallback
  const displayCost = cost > 0 ? cost : (() => {
    const est = estimateCost(effectiveModel, sessionUsage?.inputTokens ?? 0, sessionUsage?.outputTokens ?? 0);
    return est ?? 0;
  })();

  return (
    <div className="h-14 border-b border-border flex items-center px-4 gap-3 bg-card/50 shrink-0">
      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Bot className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{id || sessionKey}</span>
          <Badge variant="outline" className="text-[10px] h-5">{channelLabel(channel)}</Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {agentId && (
            <span className="flex items-center gap-1">
              <Hash className="w-3 h-3" />
              {agentId}
            </span>
          )}
          {shortModel && (
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${modelColor.bg} ${modelColor.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${modelColor.dot}`} />
              {shortModel}
            </span>
          )}
          {totalTokens > 0 && (
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3" />
              {fmtTokens(totalTokens)} tk
              {displayCost > 0 && (
                <span className="text-muted-foreground/60">
                  · {cost > 0 ? "" : "~"}${displayCost.toFixed(2)}
                </span>
              )}
            </span>
          )}
          {/* Context meter */}
          {totalTokens > 0 && (
            <span className="flex items-center gap-1.5">
              <Gauge className="w-3 h-3" />
              <span className="text-[10px]">Ctx {ctxPercent}%</span>
              <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    ctxPercent > 80 ? "bg-destructive" : ctxPercent > 50 ? "bg-amber-400" : "bg-emerald-400"
                  }`}
                  style={{ width: `${Math.min(100, ctxPercent)}%` }}
                />
              </div>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <ExportMenu messages={messages} sessionKey={sessionKey} />
        <Button
          variant={searchOpen ? "secondary" : "ghost"}
          size="icon-sm"
          onClick={onToggleSearch}
          title="Search messages (Ctrl+F)"
        >
          <Search className="w-4 h-4" />
        </Button>
        <Button
          variant={detailsOpen ? "secondary" : "ghost"}
          size="icon-sm"
          onClick={onToggleDetails}
          title="Session details"
        >
          <PanelRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
