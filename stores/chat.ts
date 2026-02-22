import { create } from "zustand";

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;        // data:image/jpeg;base64,... or blob URL
  isImage: boolean;
}

export interface ToolCall {
  id: string;
  name: string;
  input?: unknown;
  output?: unknown;
  phase?: "running" | "done" | "error";
  startedAt?: number;
  endedAt?: number;
}

export interface MessageMetadata {
  model?: string;
  provider?: string;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  toolCalls?: ToolCall[];
  thinking?: string;
  rawEvent?: unknown;
  startedAt?: number;
  finishedAt?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  state?: "delta" | "final" | "aborted" | "error";
  runId?: string;
  attachments?: Attachment[];
  metadata?: MessageMetadata;
  /** Optimistic messages have a client-generated ID before server confirmation */
  __optimisticId?: string;
  /** Error status for optimistic messages that failed to send */
  status?: "sending" | "sent" | "error";
}

/** Session-level usage from sessions.usage RPC (like clawsuite) */
export interface SessionUsage {
  model: string | null;
  modelProvider: string | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  totalCost: number;
  cacheRead: number;
  cacheWrite: number;
  messageCount: number;
}

/** Per-session streaming state (ClawSuite pattern) */
export interface StreamingState {
  runId: string | null;
  text: string;
  thinking: string;
  toolCalls: ToolCall[];
}

const EMPTY_STREAMING: StreamingState = {
  runId: null,
  text: "",
  thinking: "",
  toolCalls: [],
};

interface ChatStore {
  activeSessionKey: string | null;
  messages: ChatMessage[];
  /** Per-session streaming state map */
  streamingStates: Map<string, StreamingState>;
  error: string | null;
  sessionModel: string | null;
  sessionProvider: string | null;
  sessionUsage: SessionUsage | null;

  setActiveSession: (key: string | null) => void;
  setMessages: (msgs: ChatMessage[]) => void;
  addMessage: (msg: ChatMessage) => void;
  upsertAssistantMessage: (
    runId: string,
    content: string,
    state: ChatMessage["state"],
    metadata?: MessageMetadata,
    sessionKey?: string
  ) => void;
  /** Update streaming state for a specific session */
  setStreamingState: (sessionKey: string, state: Partial<StreamingState> | null) => void;
  /** Get streaming state for a session */
  getStreamingState: (sessionKey: string) => StreamingState;
  /** Check if any session or specific session is streaming */
  isStreaming: (sessionKey?: string) => boolean;
  setError: (e: string | null) => void;
  setSessionModel: (model: string | null, provider?: string | null) => void;
  setSessionUsage: (usage: SessionUsage | null) => void;
  /** Mark an optimistic message as errored */
  markMessageError: (optimisticId: string) => void;
  /** Mark an optimistic message as sent */
  markMessageSent: (optimisticId: string) => void;
  clear: () => void;
}

function genId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export { genId };

export const useChatStore = create<ChatStore>((set, get) => ({
  activeSessionKey: null,
  messages: [],
  streamingStates: new Map(),
  error: null,
  sessionModel: null,
  sessionProvider: null,
  sessionUsage: null,

  setActiveSession: (key) =>
    set({ activeSessionKey: key, messages: [], error: null, sessionModel: null, sessionProvider: null, sessionUsage: null }),

  setMessages: (messages) => set({ messages }),

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

  upsertAssistantMessage: (runId, content, state, metadata, sessionKey) =>
    set((s) => {
      const idx = s.messages.findIndex(
        (m) => m.runId === runId && m.role === "assistant"
      );
      if (idx >= 0) {
        const updated = [...s.messages];
        const prev = updated[idx].metadata;
        updated[idx] = {
          ...updated[idx],
          content,
          state,
          metadata: metadata
            ? { ...prev, ...metadata, startedAt: prev?.startedAt ?? metadata.startedAt }
            : prev,
        };
        return { messages: updated };
      }
      // Don't create a blank bubble on the first empty delta event
      if (!content && state === "delta") return s;
      return {
        messages: [
          ...s.messages,
          {
            id: genId(),
            role: "assistant" as const,
            content,
            timestamp: Date.now(),
            state,
            runId,
            metadata,
          },
        ],
      };
    }),

  setStreamingState: (sessionKey, state) =>
    set((s) => {
      const next = new Map(s.streamingStates);
      if (state === null) {
        next.delete(sessionKey);
      } else {
        const current = next.get(sessionKey) ?? { ...EMPTY_STREAMING };
        next.set(sessionKey, { ...current, ...state });
      }
      return { streamingStates: next };
    }),

  getStreamingState: (sessionKey) => {
    return get().streamingStates.get(sessionKey) ?? { ...EMPTY_STREAMING };
  },

  isStreaming: (sessionKey) => {
    const states = get().streamingStates;
    if (sessionKey) return states.has(sessionKey) && states.get(sessionKey)!.runId !== null;
    // Check if any session is streaming
    for (const state of states.values()) {
      if (state.runId !== null) return true;
    }
    return false;
  },

  setError: (error) => set({ error }),

  setSessionModel: (model, provider) => set({ sessionModel: model ?? null, sessionProvider: provider ?? null }),

  setSessionUsage: (sessionUsage) => set({ sessionUsage }),

  markMessageError: (optimisticId) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.__optimisticId === optimisticId ? { ...m, status: "error" as const } : m
      ),
    })),

  markMessageSent: (optimisticId) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.__optimisticId === optimisticId ? { ...m, status: "sent" as const } : m
      ),
    })),

  clear: () =>
    set({ messages: [], error: null, streamingStates: new Map(), activeSessionKey: null, sessionModel: null, sessionProvider: null, sessionUsage: null }),
}));
