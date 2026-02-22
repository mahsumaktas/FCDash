"use client";

import { memo, useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import type { ChatMessage, SessionUsage, StreamingState } from "@/stores/chat";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { messageVariants, collapseVariants } from "@/lib/animations";

// Lazy load MarkdownMessage — react-markdown + rehype-highlight bundle'ını initial load'dan çıkarır (~40KB gzip)
const MarkdownMessage = dynamic(
  () => import("./markdown-message").then((m) => ({ default: m.MarkdownMessage })),
  { ssr: false, loading: () => <span className="text-muted-foreground/40 text-xs">...</span> },
);
import {
  Bot, User, AlertCircle, XCircle, ChevronDown, ChevronUp,
  ChevronRight, Code2, Copy, Check, RotateCcw, Wrench, Brain,
  Loader2, Send, Cpu, Clock,
} from "lucide-react";
import { getModelColor, getShortModelName, estimateCost } from "@/lib/model-utils";

/* ── Helpers ─────────────────────────────────────────────────────────── */

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(startedAt?: number, finishedAt?: number): string | null {
  if (!startedAt || !finishedAt) return null;
  const ms = finishedAt - startedAt;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/* ── Tool call labels & icons ────────────────────────────────────────── */

const TOOL_LABELS: Record<string, string> = {
  web_search: "Web search",
  Read: "Reading file",
  Write: "Writing file",
  Edit: "Editing file",
  exec: "Running command",
  browser: "Browsing",
  memory_search: "Searching memory",
  sessions_spawn: "Spawning session",
  Bash: "Running command",
  Grep: "Searching code",
  Glob: "Finding files",
  WebFetch: "Fetching page",
  WebSearch: "Web search",
};

/* ── StreamingCursor ─────────────────────────────────────────────────── */

function StreamingCursor() {
  return (
    <span className="inline-flex items-center ml-0.5">
      <motion.span
        className="w-1.5 h-1.5 rounded-full bg-primary"
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
      />
    </span>
  );
}

/* ── Context-aware typing indicator ──────────────────────────────────── */

function ContextAwareTypingIndicator({ streamingState }: { streamingState?: StreamingState | null }) {
  const activeToolCalls = streamingState?.toolCalls?.filter((t) => t.phase === "running") ?? [];
  const isThinking = !!streamingState?.thinking && !streamingState?.text;

  if (isThinking) {
    return (
      <div className="flex items-center gap-2 py-1">
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-muted/60 text-xs text-muted-foreground">
          <Brain className="w-3 h-3 animate-pulse" />
          <span>Thinking...</span>
        </div>
      </div>
    );
  }

  if (activeToolCalls.length > 0) {
    const toolName = TOOL_LABELS[activeToolCalls[0].name] ?? activeToolCalls[0].name;
    return (
      <div className="flex items-center gap-2 py-1">
        <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-muted/60 text-xs text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>{toolName}...</span>
          {activeToolCalls.length > 1 && (
            <span className="text-muted-foreground/50">+{activeToolCalls.length - 1}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 py-1">
      <div className="flex items-center gap-1 px-3 py-2 rounded-2xl bg-muted/60">
        <motion.span
          className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
        />
        <motion.span
          className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
        />
        <motion.span
          className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
        />
      </div>
    </div>
  );
}

/* ── Elapsed timer (for streaming) ───────────────────────────────────── */

function ElapsedBadge({ startTime }: { startTime?: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  if (!startTime || elapsed <= 0) return null;
  return (
    <span className="text-[10px] text-muted-foreground/50 ml-1">{elapsed}s</span>
  );
}

/* ── Tool call item (collapsible) ────────────────────────────────────── */

function InlineToolCall({ call }: { call: NonNullable<ChatMessage["metadata"]>["toolCalls"] extends (infer T)[] | undefined ? T : never }) {
  const [open, setOpen] = useState(false);
  if (!call) return null;

  const label = TOOL_LABELS[call.name] ?? call.name;
  const hasOutput = call.output !== undefined;
  const isError = typeof call.output === "string" && call.output.toLowerCase().includes("error");
  const isRunning = call.phase === "running" || (!hasOutput && !isError);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      className="border border-border/50 rounded-md overflow-hidden text-xs"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isError ? "bg-destructive" : hasOutput ? "bg-green-500" : "bg-amber-400"}`}>
          {isRunning && (
            <motion.span
              className="block w-full h-full rounded-full bg-amber-400"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
          )}
        </span>
        <Wrench className="w-3 h-3 shrink-0 text-muted-foreground/60" />
        <span className="font-medium text-muted-foreground truncate">{label}</span>
        {open ? <ChevronDown className="w-3 h-3 ml-auto shrink-0 text-muted-foreground/40" /> : <ChevronRight className="w-3 h-3 ml-auto shrink-0 text-muted-foreground/40" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            variants={collapseVariants}
            className="px-2.5 py-2 space-y-1.5 bg-background"
          >
            {call.input !== undefined && (
              <div>
                <div className="text-[9px] text-muted-foreground/50 uppercase tracking-wider mb-0.5">Input</div>
                <pre className="text-[10px] font-mono bg-muted/30 rounded p-1.5 overflow-x-auto whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                  {typeof call.input === "string" ? call.input : JSON.stringify(call.input, null, 2)}
                </pre>
              </div>
            )}
            {call.output !== undefined && (
              <div>
                <div className="text-[9px] text-muted-foreground/50 uppercase tracking-wider mb-0.5">Output</div>
                <pre className={`text-[10px] font-mono rounded p-1.5 overflow-x-auto whitespace-pre-wrap break-all max-h-32 overflow-y-auto ${isError ? "bg-destructive/5 text-destructive" : "bg-muted/30"}`}>
                  {typeof call.output === "string" ? call.output : JSON.stringify(call.output, null, 2)}
                </pre>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Tool calls group (collapsible summary) ──────────────────────────── */

function ToolCallsGroup({ toolCalls }: { toolCalls: NonNullable<ChatMessage["metadata"]>["toolCalls"] }) {
  const [open, setOpen] = useState(false);
  if (!toolCalls || toolCalls.length === 0) return null;

  const names = toolCalls.map((t) => TOOL_LABELS[t.name] ?? t.name);
  const runningCount = toolCalls.filter((t) => t.phase === "running").length;
  const summary = names.length <= 3
    ? names.join(", ")
    : `${names.slice(0, 3).join(", ")} +${names.length - 3} more`;

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
      >
        <Wrench className="w-3 h-3" />
        <span>{open ? "Hide tools" : summary}</span>
        <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0 text-[9px] font-medium">{toolCalls.length}</span>
        {runningCount > 0 && (
          <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-1.5 space-y-1 overflow-hidden"
          >
            {toolCalls.map((call, i) => (
              <InlineToolCall key={call.id ?? i} call={call} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Message actions (copy, retry) ───────────────────────────────────── */

function MessageActions({
  content,
  isError,
  onRetry,
}: {
  content: string;
  isError?: boolean;
  onRetry?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* */ }
  }, [content]);

  return (
    <div className="flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity">
      <button
        onClick={handleCopy}
        className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground/50 hover:text-muted-foreground"
        title="Copy message"
      >
        {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
      </button>
      {isError && onRetry && (
        <button
          onClick={onRetry}
          className="p-1 rounded hover:bg-muted transition-colors text-destructive/60 hover:text-destructive"
          title="Retry"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

/* ── Thinking block (collapsible) ────────────────────────────────────── */

function ThinkingBlock({ thinking }: { thinking: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
      >
        <Brain className="w-3 h-3" />
        <span>{open ? "Hide thinking" : "Show thinking"}</span>
        {open ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            variants={collapseVariants}
            className="mt-1 px-3 py-2 rounded-md bg-violet-500/5 border border-violet-500/10 text-xs text-muted-foreground whitespace-pre-wrap"
          >
            {thinking}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── InlineDetails (model, tokens, timing) ───────────────────────────── */

function InlineDetails({
  message,
  sessionModel,
  sessionProvider,
  sessionUsage,
}: {
  message: ChatMessage;
  sessionModel?: string;
  sessionProvider?: string;
  sessionUsage?: SessionUsage | null;
}) {
  const [open, setOpen] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const meta = message.metadata;

  if (message.state === "delta") return null;

  const msgModel = meta?.model;
  const msgProvider = meta?.provider;
  const msgInput = meta?.inputTokens;
  const msgOutput = meta?.outputTokens;
  const duration = formatDuration(meta?.startedAt, meta?.finishedAt);

  const effectiveModel = msgModel ?? sessionUsage?.model ?? sessionModel;
  const effectiveProvider = msgProvider ?? sessionUsage?.modelProvider ?? (sessionModel?.includes("/") ? sessionModel.split("/")[0] : undefined);

  const sessInput = sessionUsage?.inputTokens ?? 0;
  const sessOutput = sessionUsage?.outputTokens ?? 0;
  const sessTotal = sessionUsage?.totalTokens ?? 0;
  const sessCost = sessionUsage?.totalCost ?? 0;

  const hasAnything = effectiveModel || effectiveProvider || duration || sessTotal > 0 || msgInput != null;
  if (!hasAnything) return null;

  const summaryParts: string[] = [];
  if (effectiveModel) summaryParts.push(effectiveModel);
  if (duration) summaryParts.push(duration);
  if (msgInput != null && msgOutput != null) {
    summaryParts.push(`${fmtTokens(msgInput + msgOutput)} tk`);
  } else if (sessTotal > 0) {
    summaryParts.push(`${fmtTokens(sessTotal)} tk`);
  }

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
      >
        {open ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
        <span>{open ? "details" : (summaryParts.join(" · ") || "details")}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            variants={collapseVariants}
            className="mt-1 px-2 py-1.5 rounded-md bg-muted/40 border border-border/50 text-[10px] text-muted-foreground space-y-0.5"
          >
            {(effectiveModel || effectiveProvider) && (() => {
              const color = getModelColor(effectiveModel);
              return (
                <div className="flex gap-1">
                  <span className="text-muted-foreground/60 w-16 shrink-0">model</span>
                  <span className={`font-medium ${color.text}`}>
                    {[effectiveModel, effectiveProvider].filter(Boolean).join(" · ")}
                  </span>
                </div>
              );
            })()}
            {duration && (
              <div className="flex gap-1">
                <span className="text-muted-foreground/60 w-16 shrink-0">duration</span>
                <span>{duration}</span>
              </div>
            )}
            {msgInput != null && (
              <div className="flex gap-1">
                <span className="text-muted-foreground/60 w-16 shrink-0">msg input</span>
                <span>{msgInput.toLocaleString()} tokens</span>
              </div>
            )}
            {msgOutput != null && (
              <div className="flex gap-1">
                <span className="text-muted-foreground/60 w-16 shrink-0">msg output</span>
                <span>{msgOutput.toLocaleString()} tokens</span>
              </div>
            )}
            {meta?.cost != null && meta.cost > 0 && (
              <div className="flex gap-1">
                <span className="text-muted-foreground/60 w-16 shrink-0">msg cost</span>
                <span>${meta.cost.toFixed(4)}</span>
              </div>
            )}
            {!meta?.cost && msgInput != null && msgOutput != null && (() => {
              const est = estimateCost(effectiveModel, msgInput, msgOutput);
              if (!est || est <= 0) return null;
              return (
                <div className="flex gap-1">
                  <span className="text-muted-foreground/60 w-16 shrink-0">est. cost</span>
                  <span className="text-muted-foreground/70">~${est.toFixed(4)}</span>
                </div>
              );
            })()}
            {sessTotal > 0 && (
              <>
                <div className="border-t border-border/30 my-1" />
                <div className="text-muted-foreground/40 text-[9px] uppercase tracking-wider">session totals</div>
                <div className="flex gap-1">
                  <span className="text-muted-foreground/60 w-16 shrink-0">input</span>
                  <span>{fmtTokens(sessInput)} tokens</span>
                </div>
                <div className="flex gap-1">
                  <span className="text-muted-foreground/60 w-16 shrink-0">output</span>
                  <span>{fmtTokens(sessOutput)} tokens</span>
                </div>
                <div className="flex gap-1">
                  <span className="text-muted-foreground/60 w-16 shrink-0">total</span>
                  <span className="font-medium">{fmtTokens(sessTotal)} tokens</span>
                </div>
                {sessCost > 0 && (
                  <div className="flex gap-1">
                    <span className="text-muted-foreground/60 w-16 shrink-0">cost</span>
                    <span>${sessCost.toFixed(4)}</span>
                  </div>
                )}
              </>
            )}
            {!!meta?.rawEvent && (
              <>
                <div className="border-t border-border/30 my-1" />
                <button
                  onClick={(e) => { e.stopPropagation(); setShowRaw((v) => !v); }}
                  className="flex items-center gap-1 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                >
                  <Code2 className="w-2.5 h-2.5" />
                  <span>{showRaw ? "hide" : "show"} raw event</span>
                </button>
                {showRaw && (
                  <pre className="mt-1 p-2 rounded bg-background border border-border text-[9px] font-mono overflow-x-auto whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                    {JSON.stringify(meta.rawEvent, null, 2)}
                  </pre>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Metadata tooltip ────────────────────────────────────────────────── */

function MetadataTooltip({ message, sessionUsage }: { message: ChatMessage; sessionUsage?: SessionUsage | null }) {
  const meta = message.metadata;
  if (!meta) return null;

  const parts: string[] = [];
  if (meta.model) parts.push(`Model: ${meta.model}`);
  if (meta.provider) parts.push(`Provider: ${meta.provider}`);
  if (meta.inputTokens) parts.push(`Input: ${fmtTokens(meta.inputTokens)}`);
  if (meta.outputTokens) parts.push(`Output: ${fmtTokens(meta.outputTokens)}`);
  const duration = formatDuration(meta.startedAt, meta.finishedAt);
  if (duration) parts.push(`Duration: ${duration}`);
  if (meta.cost) parts.push(`Cost: $${meta.cost.toFixed(4)}`);
  if (sessionUsage?.totalCost) parts.push(`Session: $${sessionUsage.totalCost.toFixed(4)}`);

  if (parts.length === 0) return null;

  return (
    <TooltipContent side="top" className="text-[10px] space-y-0.5 max-w-xs">
      {parts.map((p, i) => <div key={i}>{p}</div>)}
    </TooltipContent>
  );
}

/* ── Lightbox ────────────────────────────────────────────────────────── */

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <motion.img
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        src={src}
        alt={alt}
        className="max-w-[90vw] max-h-[90vh] rounded-lg object-contain"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      />
    </motion.div>
  );
}

/* ── Attachment grid ─────────────────────────────────────────────────── */

function AttachmentGrid({ attachments }: { attachments: NonNullable<ChatMessage["attachments"]> }) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  if (attachments.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2 mt-2">
        {attachments.map((att) => {
          if (att.isImage) {
            return (
              <div key={att.id} className="relative group cursor-pointer" onClick={() => setLightbox(att.dataUrl)}>
                <img src={att.dataUrl} alt={att.name} className="h-24 w-24 object-cover rounded-md border border-border" />
                <div className="absolute inset-0 rounded-md bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <svg className="w-4 h-4 text-white opacity-0 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                </div>
              </div>
            );
          }
          return (
            <a key={att.id} href={att.dataUrl} download={att.name} className="flex items-center gap-2 bg-muted/50 border border-border rounded-md px-3 py-2 text-xs hover:bg-muted transition-colors">
              <div>
                <div className="font-medium truncate max-w-[120px]">{att.name}</div>
                <div className="text-muted-foreground">{(att.size / 1024).toFixed(1)} KB</div>
              </div>
            </a>
          );
        })}
      </div>
      <AnimatePresence>
        {lightbox && <Lightbox src={lightbox} alt="attachment" onClose={() => setLightbox(null)} />}
      </AnimatePresence>
    </>
  );
}

/* ── MessageBubble ───────────────────────────────────────────────────── */

interface MessageBubbleProps {
  message: ChatMessage;
  onShowDetails?: (msg: ChatMessage) => void;
  onRetry?: (msg: ChatMessage) => void;
  sessionModel?: string;
  sessionProvider?: string;
  sessionUsage?: SessionUsage | null;
  streamingState?: StreamingState | null;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  onShowDetails,
  onRetry,
  sessionModel,
  sessionProvider,
  sessionUsage,
  streamingState,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isError = message.state === "error";
  const isAborted = message.state === "aborted";
  const isDelta = message.state === "delta";
  const isSending = message.status === "sending";
  const isSendError = message.status === "error";

  if (isUser) {
    return (
      <motion.div
        variants={messageVariants}
        initial="initial"
        animate="animate"
        className="flex justify-end gap-2 group/msg"
      >
        <div className="max-w-[75%] space-y-1">
          <div className={`bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5 text-sm ${isSendError ? "opacity-60 border-2 border-destructive/30" : ""}`}>
            <MarkdownMessage content={message.content} />
            {message.attachments && message.attachments.length > 0 && (
              <AttachmentGrid attachments={message.attachments} />
            )}
          </div>
          <div className="flex items-center justify-end gap-1 px-1">
            {isSending && <Send className="w-2.5 h-2.5 text-muted-foreground/40 animate-pulse" />}
            {isSendError && (
              <button
                onClick={() => onRetry?.(message)}
                className="flex items-center gap-1 text-[10px] text-destructive hover:text-destructive/80 transition-colors"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Retry</span>
              </button>
            )}
            <MessageActions content={message.content} />
            <span className="text-[10px] text-muted-foreground">
              {formatTimestamp(message.timestamp)}
            </span>
          </div>
        </div>
        <Avatar size="sm">
          <AvatarFallback>
            <User className="w-3 h-3" />
          </AvatarFallback>
        </Avatar>
      </motion.div>
    );
  }

  // Assistant message — model fallback chain: event metadata > session usage > store sessionModel
  const chipModel = message.metadata?.model ?? sessionUsage?.model ?? sessionModel;
  const chipProvider = message.metadata?.provider ?? sessionUsage?.modelProvider ?? sessionProvider;
  const thinking = message.metadata?.thinking ?? null;
  const shortModelName = getShortModelName(chipModel);
  const modelColor = getModelColor(chipModel);

  // Thinking duration
  const thinkingDuration = (() => {
    const meta = message.metadata;
    if (!meta?.startedAt || !meta?.finishedAt) return null;
    if (!thinking && !meta?.thinking) return null;
    // Approximate: thinking time is total time minus a rough output estimate
    const totalMs = meta.finishedAt - meta.startedAt;
    if (totalMs < 500) return null;
    return totalMs < 1000 ? `${totalMs}ms` : `${(totalMs / 1000).toFixed(1)}s`;
  })();

  // Cost estimation fallback
  const estimatedCost = (() => {
    if (message.metadata?.cost) return null; // real cost exists
    const input = message.metadata?.inputTokens ?? 0;
    const output = message.metadata?.outputTokens ?? 0;
    return estimateCost(chipModel, input, output);
  })();

  return (
    <motion.div
      variants={messageVariants}
      initial="initial"
      animate="animate"
      className="flex justify-start gap-2 group/msg"
    >
      <Avatar size="sm">
        <AvatarFallback className="bg-primary/10 text-primary">
          <Bot className="w-3 h-3" />
        </AvatarFallback>
      </Avatar>
      <div className="max-w-[75%] space-y-1">
        <div
          className={`bg-card border border-border rounded-2xl rounded-bl-md px-4 py-2.5 text-sm ${
            isError
              ? "border-destructive/30 bg-destructive/5"
              : isAborted
                ? "opacity-60"
                : ""
          }`}
        >
          {/* Model badge — color-coded like Telegram */}
          {shortModelName && message.state !== "delta" && (
            <div className="flex items-center gap-1.5 mb-1.5 -mt-0.5">
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${modelColor.bg} ${modelColor.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${modelColor.dot}`} />
                {shortModelName}
              </span>
              {thinkingDuration && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/50">
                  <Clock className="w-2.5 h-2.5" />
                  {thinkingDuration}
                </span>
              )}
              {estimatedCost != null && estimatedCost > 0 && (
                <span className="text-[10px] text-muted-foreground/40">
                  ~${estimatedCost < 0.01 ? estimatedCost.toFixed(4) : estimatedCost.toFixed(3)}
                </span>
              )}
            </div>
          )}
          {/* Per-message token usage line — always visible for final messages */}
          {message.state !== "delta" && (message.metadata?.inputTokens != null || message.metadata?.outputTokens != null) && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground/40 mb-1 -mt-0.5 font-mono">
              <span className="opacity-60">↳</span>
              <span>{fmtTokens(message.metadata?.inputTokens ?? 0)} in</span>
              <span className="opacity-40">·</span>
              <span>{fmtTokens(message.metadata?.outputTokens ?? 0)} out</span>
            </div>
          )}
          {isError && !message.content ? (
            <div className="flex items-center gap-2 text-destructive text-xs">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>An error occurred</span>
            </div>
          ) : isAborted && !message.content ? (
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <XCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Response aborted</span>
            </div>
          ) : isDelta && !message.content ? (
            <ContextAwareTypingIndicator streamingState={streamingState} />
          ) : (
            <>
              {/* Thinking block (collapsible) */}
              {thinking && <ThinkingBlock thinking={thinking} />}
              <MarkdownMessage content={message.content} />
              {isDelta && <StreamingCursor />}
              {isDelta && <ElapsedBadge startTime={message.metadata?.startedAt} />}
              {message.attachments && message.attachments.length > 0 && (
                <AttachmentGrid attachments={message.attachments} />
              )}
            </>
          )}
        </div>

        {/* Tool calls section */}
        {message.metadata?.toolCalls && message.metadata.toolCalls.length > 0 && (
          <ToolCallsGroup toolCalls={message.metadata.toolCalls} />
        )}

        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">
              {formatTimestamp(message.timestamp)}
            </span>
            {isAborted && (
              <span className="text-[10px] text-muted-foreground/60">(aborted)</span>
            )}
            <MessageActions
              content={message.content}
              isError={isError}
              onRetry={onRetry ? () => onRetry(message) : undefined}
            />
          </div>
          {(chipModel || chipProvider) && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onShowDetails?.(message)}
                    title="Click to view details"
                    className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer"
                  >
                    {[chipModel, chipProvider].filter(Boolean).join(" · ")}
                  </button>
                </TooltipTrigger>
                <MetadataTooltip message={message} sessionUsage={sessionUsage} />
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <InlineDetails
          message={message}
          sessionModel={sessionModel}
          sessionProvider={sessionProvider}
          sessionUsage={sessionUsage}
        />
      </div>
    </motion.div>
  );
});
