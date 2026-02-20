import { create } from "zustand";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  state?: "delta" | "final" | "aborted" | "error";
  runId?: string;
}

interface ChatStore {
  activeSessionKey: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  setActiveSession: (key: string | null) => void;
  setMessages: (msgs: ChatMessage[]) => void;
  addMessage: (msg: ChatMessage) => void;
  upsertAssistantMessage: (runId: string, content: string, state: ChatMessage["state"]) => void;
  setStreaming: (v: boolean) => void;
  setError: (e: string | null) => void;
  clear: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  activeSessionKey: null,
  messages: [],
  isStreaming: false,
  error: null,

  setActiveSession: (key) => set({ activeSessionKey: key, messages: [], error: null, isStreaming: false }),
  setMessages: (messages) => set({ messages }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  upsertAssistantMessage: (runId, content, state) => set((s) => {
    const idx = s.messages.findIndex((m) => m.runId === runId && m.role === "assistant");
    if (idx >= 0) {
      const updated = [...s.messages];
      updated[idx] = { ...updated[idx], content, state };
      return { messages: updated };
    }
    return {
      messages: [...s.messages, {
        id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2),
        role: "assistant" as const,
        content,
        timestamp: Date.now(),
        state,
        runId,
      }],
    };
  }),
  setStreaming: (isStreaming) => set({ isStreaming }),
  setError: (error) => set({ error }),
  clear: () => set({ messages: [], error: null, isStreaming: false, activeSessionKey: null }),
}));
