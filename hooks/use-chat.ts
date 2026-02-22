"use client";

import { useCallback, useEffect, useRef, useMemo } from "react";
import { useGatewaySSEStore } from "@/stores/gateway-sse";
import { api } from "@/lib/api-client";
import { useChatStore, genId } from "@/stores/chat";
import type { ChatMessage, Attachment, MessageMetadata, SessionUsage } from "@/stores/chat";
import type { ChatEvent } from "@/lib/types";

function extractText(message: unknown): string {
  if (typeof message === "string") return message;
  if (!message) return "";
  if (typeof message === "object") {
    const m = message as Record<string, unknown>;
    if (Array.isArray(m.content)) {
      return (m.content as Array<{ type: string; text?: string }>)
        .filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join("");
    }
    if (typeof m.content === "string") return m.content;
    if (typeof m.text === "string") return m.text;
    if (typeof m.delta === "string") return m.delta;
  }
  return "";
}

/* ── Robust usage extraction ──
   Based on analysis of 12 OpenClaw dashboard repos:
   - Gateway uses: promptTokens, completionTokens, totalTokens, costUsd
   - Sessions.list uses: inputTokens, outputTokens, totalTokens
   - Sessions.usage uses: usage.input, usage.output, usage.totalCost
   - Some use: input_tokens, output_tokens, prompt_tokens
   We try ALL patterns across event root, event.usage, and event.message
*/
function str(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === "number" && !isNaN(v) ? v : undefined;
}

function tryExtract(sources: Record<string, unknown>[]): {
  model?: string; provider?: string; inputTokens?: number; outputTokens?: number; cost?: number;
} {
  let model: string | undefined;
  let provider: string | undefined;
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
  let cost: number | undefined;

  for (const s of sources) {
    if (!s) continue;
    model = model ?? str(s.model) ?? str(s.modelId) ?? str(s.model_id);
    provider = provider ?? str(s.provider) ?? str(s.modelProvider) ?? str(s.model_provider);
    inputTokens = inputTokens
      ?? num(s.inputTokens) ?? num(s.input_tokens)
      ?? num(s.promptTokens) ?? num(s.prompt_tokens)
      ?? num(s.input);
    outputTokens = outputTokens
      ?? num(s.outputTokens) ?? num(s.output_tokens)
      ?? num(s.completionTokens) ?? num(s.completion_tokens)
      ?? num(s.output);
    cost = cost ?? num(s.costUsd) ?? num(s.cost) ?? num(s.totalCost);
  }

  return { model, provider, inputTokens, outputTokens, cost };
}

/** Extract thinking text from message content array */
function extractThinking(message: unknown): string | undefined {
  if (!message || typeof message !== "object") return undefined;
  const m = message as Record<string, unknown>;
  if (Array.isArray(m.content)) {
    const parts = m.content as Array<{ type: string; thinking?: string; text?: string }>;
    const thinkingPart = parts.find((p) => p.type === "thinking");
    if (thinkingPart && thinkingPart.thinking) return String(thinkingPart.thinking);
  }
  if (typeof m.thinking === "string" && m.thinking) return m.thinking;
  return undefined;
}

/** Extract tool calls from message content array */
function extractToolCalls(event: ChatEvent): MessageMetadata["toolCalls"] {
  const msg = event.message as Record<string, unknown> | undefined;
  if (!msg) return undefined;

  const calls: NonNullable<MessageMetadata["toolCalls"]> = [];

  if (Array.isArray(msg.content)) {
    for (const part of msg.content as Array<Record<string, unknown>>) {
      if (part.type === "tool_use" || part.type === "tool_call") {
        calls.push({
          id: String(part.id ?? part.toolCallId ?? genId()),
          name: String(part.name ?? part.function ?? "unknown"),
          input: part.input ?? part.arguments,
          phase: "running",
        });
      }
      if (part.type === "tool_result") {
        const callId = String(part.tool_use_id ?? part.toolCallId ?? "");
        const existing = calls.find((c) => c.id === callId);
        if (existing) {
          existing.output = part.content ?? part.output ?? part.result;
          existing.phase = "done";
        } else {
          calls.push({
            id: callId || genId(),
            name: String(part.name ?? "tool_result"),
            output: part.content ?? part.output ?? part.result,
            phase: "done",
          });
        }
      }
    }
  }

  const topCalls = (msg.toolCalls ?? msg.tool_calls ?? (event as Record<string, unknown>).toolCalls) as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(topCalls)) {
    for (const tc of topCalls) {
      calls.push({
        id: String(tc.id ?? genId()),
        name: String(tc.name ?? tc.function ?? "unknown"),
        input: tc.input ?? tc.arguments,
        output: tc.output ?? tc.result,
        phase: tc.output !== undefined ? "done" : "running",
      });
    }
  }

  return calls.length > 0 ? calls : undefined;
}

function extractMetadataFromEvent(event: ChatEvent): Omit<MessageMetadata, "rawEvent" | "startedAt" | "finishedAt"> {
  const e = event as unknown as Record<string, unknown>;
  const u = (event.usage ?? {}) as Record<string, unknown>;
  const msg = (event.message ?? {}) as Record<string, unknown>;
  const msgDetails = (msg.details ?? {}) as Record<string, unknown>;
  const uNested = (typeof u.usage === "object" && u.usage ? u.usage : null) as Record<string, unknown> | null;
  const msgData = (msg.data ?? {}) as Record<string, unknown>;

  const sources = [u, e, msg, msgDetails, msgData];
  if (uNested) sources.push(uNested);

  const extracted = tryExtract(sources);
  const thinking = extractThinking(event.message);
  const toolCalls = extractToolCalls(event);

  return { ...extracted, thinking, toolCalls };
}

// ── Message filtering & dedup helpers ────────────────────────────────────────

const SYSTEM_NOISE = /^(HEARTBEAT_OK|NO_?REPLY|PING|PONG)$/i;
const DEDUP_WINDOW_MS = 5_000;

function contentFingerprint(msg: ChatMessage): string {
  return `${msg.role}:${msg.content.trim().slice(0, 200)}`;
}

// ── useDisplayMessages hook (Phase 1.3) ──────────────────────────────────────

export function useDisplayMessages(messages: ChatMessage[]): ChatMessage[] {
  return useMemo(() => {
    // Layer 1: Filter system noise and toolResult-only messages
    const filtered = messages.filter((msg) => {
      const cleanedText = msg.content.trim();
      if (SYSTEM_NOISE.test(cleanedText)) return false;
      // Don't filter user messages or non-empty assistant messages
      return true;
    });

    // Layer 2: Deduplicate consecutive user messages within 5s window
    const seenFingerprints = new Map<string, number>();
    return filtered.filter((msg) => {
      if (msg.role !== "user") return true;
      const fp = contentFingerprint(msg);
      const prev = seenFingerprints.get(fp);
      if (prev !== undefined && Math.abs(msg.timestamp - prev) <= DEDUP_WINDOW_MS) {
        return false;
      }
      seenFingerprints.set(fp, msg.timestamp);
      return true;
    });
  }, [messages]);
}

// ── Main useChat hook ────────────────────────────────────────────────────────

export function useChat() {
  const sseSubscribe = useGatewaySSEStore((s) => s.subscribe);
  const gatewayState = useGatewaySSEStore((s) => s.gatewayState);
  const isConnected = gatewayState === "connected";

  const activeSessionKey = useChatStore((s) => s.activeSessionKey);
  const messages = useChatStore((s) => s.messages);
  const streamingStates = useChatStore((s) => s.streamingStates);
  const error = useChatStore((s) => s.error);
  const sessionModel = useChatStore((s) => s.sessionModel);
  const sessionProvider = useChatStore((s) => s.sessionProvider);
  const sessionUsage = useChatStore((s) => s.sessionUsage);
  const setActiveSession = useChatStore((s) => s.setActiveSession);
  const setMessages = useChatStore((s) => s.setMessages);
  const addMessage = useChatStore((s) => s.addMessage);
  const upsertAssistantMessage = useChatStore((s) => s.upsertAssistantMessage);
  const setStreamingState = useChatStore((s) => s.setStreamingState);
  const setError = useChatStore((s) => s.setError);
  const setSessionModel = useChatStore((s) => s.setSessionModel);
  const setSessionUsage = useChatStore((s) => s.setSessionUsage);
  const markMessageError = useChatStore((s) => s.markMessageError);
  const markMessageSent = useChatStore((s) => s.markMessageSent);

  const runStartTimesRef = useRef<Map<string, number>>(new Map());
  const sessionKeyRef = useRef<string | null>(activeSessionKey);
  const messagesCountRef = useRef(0);
  const usagePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevConnectionRef = useRef<string>(gatewayState);
  const queuedMessagesRef = useRef<Map<string, { text: string; attachments?: Attachment[] }>>(new Map());

  sessionKeyRef.current = activeSessionKey;
  messagesCountRef.current = messages.length;

  // Derive isStreaming for the active session
  const isStreaming = useMemo(() => {
    if (!activeSessionKey) return false;
    const ss = streamingStates.get(activeSessionKey);
    return ss ? ss.runId !== null : false;
  }, [activeSessionKey, streamingStates]);

  // Derive current streaming state for the active session
  const currentStreamingState = useMemo(() => {
    if (!activeSessionKey) return null;
    return streamingStates.get(activeSessionKey) ?? null;
  }, [activeSessionKey, streamingStates]);

  // ── Gateway recovery: auto-retry queued messages ──
  useEffect(() => {
    const wasDisconnected = prevConnectionRef.current !== "connected";
    const nowConnected = gatewayState === "connected";
    prevConnectionRef.current = gatewayState;

    if (wasDisconnected && nowConnected && queuedMessagesRef.current.size > 0) {
      // Auto-retry queued messages on reconnect
      const queued = new Map(queuedMessagesRef.current);
      queuedMessagesRef.current.clear();
      for (const [optimisticId, { text, attachments }] of queued) {
        // Retry sending
        api.rpc("chat.send", {
          sessionKey: sessionKeyRef.current!,
          message: text,
          idempotencyKey: genId(),
          attachments: attachments?.map((a) => ({
            type: a.mimeType,
            name: a.name,
            data: a.dataUrl.split(",")[1] ?? a.dataUrl,
          })),
        }).then(() => {
          markMessageSent(optimisticId);
        }).catch(() => {
          markMessageError(optimisticId);
        });
      }
    }
  }, [gatewayState, markMessageSent, markMessageError]);

  // ── Fetch session usage via sessions.usage RPC ──
  const fetchSessionUsage = useCallback(
    async (key: string) => {
      try {
        const result = await api.rpc("sessions.usage", { limit: 50 });
        const sessions = (result as { sessions?: unknown[] })?.sessions ?? (Array.isArray(result) ? result : []);
        const found = (sessions as Record<string, unknown>[]).find(
          (s) => s.key === key
        );
        if (!found) return;

        const u = (found.usage ?? found) as Record<string, unknown>;
        const usage: SessionUsage = {
          model: str(found.model) ?? str(found.modelOverride) ?? null,
          modelProvider: str(found.modelProvider) ?? str(found.provider) ?? null,
          inputTokens: num(u.input) ?? num(u.inputTokens) ?? num(u.input_tokens) ?? num(u.promptTokens) ?? 0,
          outputTokens: num(u.output) ?? num(u.outputTokens) ?? num(u.output_tokens) ?? num(u.completionTokens) ?? 0,
          totalTokens: num(u.totalTokens) ?? num(u.total_tokens) ?? num(u.tokens) ?? 0,
          totalCost: num(u.totalCost) ?? num(u.cost) ?? num(u.costUsd) ?? 0,
          cacheRead: num(u.cacheRead) ?? 0,
          cacheWrite: num(u.cacheWrite) ?? 0,
          messageCount: num((u.messageCounts as Record<string, unknown>)?.assistant) ?? 0,
        };
        if (usage.totalTokens === 0 && (usage.inputTokens > 0 || usage.outputTokens > 0)) {
          usage.totalTokens = usage.inputTokens + usage.outputTokens;
        }
        setSessionUsage(usage);
        if (usage.model) {
          setSessionModel(usage.model, usage.modelProvider);
        }
      } catch {
        // sessions.usage might not be available
      }
    },
    [setSessionUsage, setSessionModel]
  );

  // ── Try sessions.list for model info ──
  const fetchSessionFromList = useCallback(
    async (key: string) => {
      try {
        const result = await api.rpc("sessions.list", { limit: 500 });
        const found = (result?.sessions ?? []).find(
          (s: { key: string; model?: string; origin?: { provider?: string } }) => s.key === key
        );
        if (found?.model) {
          setSessionModel(found.model, found.origin?.provider ?? null);
        }
      } catch { /* ignore */ }
    },
    [setSessionModel]
  );

  // ── For agent sessions, read model from gateway config ──
  const fetchAgentModel = useCallback(
    async (key: string) => {
      const agentMatch = key.match(/^agent:([^:]+):/);
      if (!agentMatch) return;
      try {
        const result = await api.rpc("config.get") as { raw?: string };
        if (!result?.raw) return;
        const config = JSON.parse(result.raw);
        const agents = config?.agents?.list as Array<{ id: string; model?: { primary?: string } }> | undefined;
        const agent = agents?.find((a) => a.id === agentMatch[1]);
        if (agent?.model?.primary) {
          const model = agent.model.primary;
          const provider = model.includes("/") ? model.split("/")[0] : null;
          setSessionModel(model, provider);
        }
      } catch { /* ignore */ }
    },
    [setSessionModel]
  );

  // ── Chat event handler ──
  useEffect(() => {
    if (!isConnected) return;

    return sseSubscribe("chat", (payload: unknown) => {
      const event = payload as ChatEvent;
      const activeKey = sessionKeyRef.current;
      if (!activeKey) return;
      if (!event.sessionKey?.endsWith(activeKey)) return;

      if (process.env.NODE_ENV === "development") {
        console.debug("[chat event]", event.state, JSON.parse(JSON.stringify(event)));
      }

      if (event.state === "delta") {
        // Update per-session streaming state
        const text = extractText(event.message);
        const deltaMeta = extractMetadataFromEvent(event);
        if (!runStartTimesRef.current.has(event.runId)) {
          runStartTimesRef.current.set(event.runId, Date.now());
        }

        setStreamingState(activeKey, {
          runId: event.runId,
          text,
          thinking: deltaMeta.thinking ?? "",
          toolCalls: deltaMeta.toolCalls ?? [],
        });

        upsertAssistantMessage(event.runId, text, "delta", {
          ...deltaMeta,
          rawEvent: event,
          startedAt: runStartTimesRef.current.get(event.runId),
        });
      } else if (event.state === "final") {
        // Clear streaming state for this session
        setStreamingState(activeKey, null);

        const finishedAt = Date.now();
        const text = extractText(event.message);
        const extracted = extractMetadataFromEvent(event);
        const metadata: MessageMetadata = {
          ...extracted,
          rawEvent: event,
          startedAt: runStartTimesRef.current.get(event.runId),
          finishedAt,
        };
        runStartTimesRef.current.delete(event.runId);
        upsertAssistantMessage(event.runId, text || "", "final", metadata);

        if (extracted.model) {
          setSessionModel(extracted.model, extracted.provider);
        }

        if (sessionKeyRef.current) {
          fetchSessionUsage(sessionKeyRef.current);
        }
      } else if (event.state === "aborted" || event.state === "error") {
        setStreamingState(activeKey, null);
        runStartTimesRef.current.delete(event.runId);
        if (event.errorMessage) setError(event.errorMessage);
        upsertAssistantMessage(event.runId, "", event.state);
      }
    });
  }, [isConnected, sseSubscribe, upsertAssistantMessage, setStreamingState, setError, setSessionModel, fetchSessionUsage]);

  // ── Poll session usage every 10s ──
  useEffect(() => {
    if (usagePollRef.current) {
      clearInterval(usagePollRef.current);
      usagePollRef.current = null;
    }
    if (!isConnected || !activeSessionKey) return;

    fetchSessionUsage(activeSessionKey);

    usagePollRef.current = setInterval(() => {
      if (sessionKeyRef.current) {
        fetchSessionUsage(sessionKeyRef.current);
      }
    }, 10_000);

    return () => {
      if (usagePollRef.current) {
        clearInterval(usagePollRef.current);
        usagePollRef.current = null;
      }
    };
  }, [isConnected, activeSessionKey, fetchSessionUsage]);

  const loadHistory = useCallback(
    async (sessionKey: string) => {
      try {
        const result = await api.rpc("chat.history", {
          sessionKey,
          limit: 50,
        });
        const history = result?.messages ?? [];
        if (Array.isArray(history) && history.length > 0) {
          const mapped: ChatMessage[] = history.map((h: unknown) => {
            const item = h as Record<string, unknown>;
            return {
              id: (item.id as string) ?? genId(),
              role: ((item.role as string) ?? "assistant") as "user" | "assistant",
              content: extractText(item),
              timestamp: (item.timestamp as number) ?? Date.now(),
              state: "final" as const,
            };
          });
          setMessages(mapped);
        }
      } catch {
        // History might not be available for new sessions
      }
    },
    [setMessages]
  );

  const abort = useCallback(async () => {
    if (!activeSessionKey) return;
    const ss = streamingStates.get(activeSessionKey);
    if (!ss?.runId) return;
    try {
      await api.rpc("chat.abort", {
        sessionKey: activeSessionKey,
        runId: ss.runId,
      });
    } catch {
      /* ignore */
    }
    setStreamingState(activeSessionKey, null);
  }, [activeSessionKey, streamingStates, setStreamingState]);

  // Enable responseUsage on session so gateway sends token/model data
  const patchSessionBeforeSend = useCallback(
    async (key: string) => {
      try {
        await api.rpc("sessions.patch", { key, responseUsage: "full" });
      } catch {
        // Session might not exist yet
      }
    },
    []
  );

  const sendMessage = useCallback(
    async (text: string, attachments?: Attachment[]) => {
      if (!text.trim() && (!attachments || attachments.length === 0)) return;
      if (!sessionKeyRef.current) return;
      setError(null);

      // Optimistic message with client ID
      const optimisticId = genId();
      const userMsg: ChatMessage = {
        id: genId(),
        role: "user",
        content: text,
        timestamp: Date.now(),
        attachments,
        __optimisticId: optimisticId,
        status: "sending",
      };
      addMessage(userMsg);

      // Set streaming state immediately
      const activeKey = sessionKeyRef.current;
      setStreamingState(activeKey, { runId: "__pending", text: "", thinking: "", toolCalls: [] });

      try {
        // Patch session: enable usage reporting + set model override
        await patchSessionBeforeSend(sessionKeyRef.current).catch(() => {});
        await api.rpc("chat.send", {
          sessionKey: sessionKeyRef.current,
          message: text,
          idempotencyKey: genId(),
          attachments: attachments?.map((a) => ({
            type: a.mimeType,
            name: a.name,
            data: a.dataUrl.split(",")[1] ?? a.dataUrl,
          })),
        });
        markMessageSent(optimisticId);
      } catch (err) {
        setStreamingState(activeKey, null);
        markMessageError(optimisticId);
        // Queue for retry on reconnect
        queuedMessagesRef.current.set(optimisticId, { text, attachments });
        setError(err instanceof Error ? err.message : "Failed to send");
      }
    },
    [addMessage, setError, setStreamingState, patchSessionBeforeSend, markMessageSent, markMessageError]
  );

  const retryMessage = useCallback(
    async (msg: ChatMessage) => {
      if (!msg.__optimisticId || msg.status !== "error") return;
      const queued = queuedMessagesRef.current.get(msg.__optimisticId);
      if (!queued) return;

      queuedMessagesRef.current.delete(msg.__optimisticId);
      markMessageSent(msg.__optimisticId);

      const activeKey = sessionKeyRef.current;
      if (!activeKey) return;

      setStreamingState(activeKey, { runId: "__pending", text: "", thinking: "", toolCalls: [] });

      try {
        await patchSessionBeforeSend(activeKey).catch(() => {});
        await api.rpc("chat.send", {
          sessionKey: activeKey,
          message: queued.text,
          idempotencyKey: genId(),
          attachments: queued.attachments?.map((a) => ({
            type: a.mimeType,
            name: a.name,
            data: a.dataUrl.split(",")[1] ?? a.dataUrl,
          })),
        });
      } catch (err) {
        setStreamingState(activeKey, null);
        markMessageError(msg.__optimisticId);
        queuedMessagesRef.current.set(msg.__optimisticId, queued);
        setError(err instanceof Error ? err.message : "Failed to send");
      }
    },
    [setStreamingState, patchSessionBeforeSend, markMessageSent, markMessageError, setError]
  );

  const switchSession = useCallback(
    async (key: string) => {
      setActiveSession(key);
      await Promise.all([
        loadHistory(key),
        patchSessionBeforeSend(key),
        fetchSessionFromList(key),
        fetchSessionUsage(key),
        fetchAgentModel(key),
      ]);
    },
    [setActiveSession, loadHistory, patchSessionBeforeSend, fetchSessionFromList, fetchSessionUsage, fetchAgentModel]
  );

  return {
    messages,
    isStreaming,
    currentStreamingState,
    error,
    activeSessionKey,
    isConnected,
    sessionModel,
    sessionProvider,
    sessionUsage,
    sendMessage,
    abort,
    loadHistory,
    switchSession,
    retryMessage,
  };
}
