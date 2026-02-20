"use client";

import { useCallback, useEffect, useRef } from "react";
import { useGatewayStore } from "@/stores/gateway";
import { useChatStore, type ChatMessage } from "@/stores/chat";
import type { ChatEvent } from "@/lib/types";

// Extract text from various message formats the gateway may return
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

function generateId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function useChat() {
  const rpc = useGatewayStore((s) => s.rpc);
  const subscribe = useGatewayStore((s) => s.subscribe);
  const isConnected = useGatewayStore((s) => s.state === "connected");

  const activeSessionKey = useChatStore((s) => s.activeSessionKey);
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const error = useChatStore((s) => s.error);
  const setActiveSession = useChatStore((s) => s.setActiveSession);
  const setMessages = useChatStore((s) => s.setMessages);
  const addMessage = useChatStore((s) => s.addMessage);
  const upsertAssistantMessage = useChatStore(
    (s) => s.upsertAssistantMessage
  );
  const setStreaming = useChatStore((s) => s.setStreaming);
  const setError = useChatStore((s) => s.setError);

  const currentRunIdRef = useRef<string | null>(null);
  const sessionKeyRef = useRef<string | null>(activeSessionKey);
  sessionKeyRef.current = activeSessionKey;

  // Subscribe to chat events from the gateway
  useEffect(() => {
    if (!isConnected) return;

    return subscribe("chat", (event: ChatEvent) => {
      // Match by suffix since gateway prefixes session keys
      if (!sessionKeyRef.current) return;
      if (!event.sessionKey?.endsWith(sessionKeyRef.current)) return;

      if (event.state === "delta") {
        setStreaming(true);
        currentRunIdRef.current = event.runId;
        const text = extractText(event.message);
        upsertAssistantMessage(event.runId, text, "delta");
      } else if (event.state === "final") {
        setStreaming(false);
        currentRunIdRef.current = null;
        const text = extractText(event.message);
        upsertAssistantMessage(event.runId, text || "", "final");
      } else if (event.state === "aborted" || event.state === "error") {
        setStreaming(false);
        currentRunIdRef.current = null;
        if (event.errorMessage) setError(event.errorMessage);
        upsertAssistantMessage(event.runId, "", event.state);
      }
    });
  }, [isConnected, subscribe, upsertAssistantMessage, setStreaming, setError]);

  // Load chat history for a session
  const loadHistory = useCallback(
    async (sessionKey: string) => {
      try {
        const result = await rpc("chat.history", {
          sessionKey,
          limit: 50,
        });
        const history =
          (result as { messages?: unknown[] })?.messages ??
          (Array.isArray(result) ? result : []);
        if (Array.isArray(history) && history.length > 0) {
          const mapped: ChatMessage[] = history.map(
            (h: unknown) => {
              const item = h as Record<string, unknown>;
              return {
                id: (item.id as string) ?? generateId(),
                role: ((item.role as string) ?? "assistant") as
                  | "user"
                  | "assistant",
                content: extractText(item),
                timestamp: (item.timestamp as number) ?? Date.now(),
                state: "final" as const,
              };
            }
          );
          setMessages(mapped);
        }
      } catch {
        // History might not be available for new sessions
      }
    },
    [rpc, setMessages]
  );

  // Send a message to the active session
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !sessionKeyRef.current) return;
      setError(null);

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: text,
        timestamp: Date.now(),
      };
      addMessage(userMsg);

      try {
        await rpc("chat.send", {
          sessionKey: sessionKeyRef.current,
          message: text,
          idempotencyKey: generateId(),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send");
      }
    },
    [rpc, addMessage, setError]
  );

  // Abort the current streaming response
  const abort = useCallback(async () => {
    if (!currentRunIdRef.current || !sessionKeyRef.current) return;
    try {
      await rpc("chat.abort", {
        sessionKey: sessionKeyRef.current,
        runId: currentRunIdRef.current,
      });
    } catch {
      /* ignore abort failures */
    }
    setStreaming(false);
  }, [rpc, setStreaming]);

  // Switch to a different session (clears messages and loads history)
  const switchSession = useCallback(
    async (key: string) => {
      setActiveSession(key);
      await loadHistory(key);
    },
    [setActiveSession, loadHistory]
  );

  return {
    messages,
    isStreaming,
    error,
    activeSessionKey,
    isConnected,
    sendMessage,
    abort,
    loadHistory,
    switchSession,
  };
}
