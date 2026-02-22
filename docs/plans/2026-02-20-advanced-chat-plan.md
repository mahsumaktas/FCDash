# Advanced Chat UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the basic chat into a production-grade Telegram-like messaging interface with markdown rendering, file attachments, a slide-over details panel, and client-side message search.

**Architecture:** Evolutionary extension of the existing component structure. New types are added to the store and lib/types.ts, new components are added under components/chat/, and the existing page/hook is updated to wire them together. No rewrites of working code.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zustand 5, Tailwind CSS 4, shadcn/ui (Sheet, Tabs), react-markdown, remark-gfm, rehype-highlight

---

## Task 1: Install markdown dependencies

**Files:**
- Modify: `package.json` (via npm install)

**Step 1: Install packages**

```bash
cd .
npm install react-markdown remark-gfm rehype-highlight
npm install --save-dev @types/hast
```

**Step 2: Verify install**

```bash
node -e "require('react-markdown'); console.log('ok')"
```
Expected: `ok`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-markdown, remark-gfm, rehype-highlight"
```

---

## Task 2: Extend types — Attachment, MessageMetadata, ToolCall

**Files:**
- Modify: `stores/chat.ts` — add Attachment, MessageMetadata, ToolCall interfaces and update ChatMessage
- Modify: `lib/types.ts` — update ChatSendParams.attachments to typed array

**Step 1: Update `stores/chat.ts`**

Replace the file content with the following (add new interfaces above ChatMessage, extend ChatMessage):

```ts
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
  rawEvent?: unknown;
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
}

interface ChatStore {
  activeSessionKey: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  setActiveSession: (key: string | null) => void;
  setMessages: (msgs: ChatMessage[]) => void;
  addMessage: (msg: ChatMessage) => void;
  upsertAssistantMessage: (
    runId: string,
    content: string,
    state: ChatMessage["state"],
    metadata?: MessageMetadata
  ) => void;
  setStreaming: (v: boolean) => void;
  setError: (e: string | null) => void;
  clear: () => void;
}

function genId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const useChatStore = create<ChatStore>((set) => ({
  activeSessionKey: null,
  messages: [],
  isStreaming: false,
  error: null,

  setActiveSession: (key) =>
    set({ activeSessionKey: key, messages: [], error: null, isStreaming: false }),
  setMessages: (messages) => set({ messages }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  upsertAssistantMessage: (runId, content, state, metadata) =>
    set((s) => {
      const idx = s.messages.findIndex(
        (m) => m.runId === runId && m.role === "assistant"
      );
      if (idx >= 0) {
        const updated = [...s.messages];
        updated[idx] = {
          ...updated[idx],
          content,
          state,
          metadata: metadata ?? updated[idx].metadata,
        };
        return { messages: updated };
      }
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
  setStreaming: (isStreaming) => set({ isStreaming }),
  setError: (error) => set({ error }),
  clear: () =>
    set({ messages: [], error: null, isStreaming: false, activeSessionKey: null }),
}));
```

**Step 2: Update `lib/types.ts` — ChatSendParams attachments**

Find `ChatSendParams` (around line 109) and change `attachments?: unknown[]` to:

```ts
attachments?: Array<{
  type: string;   // MIME type, e.g. "image/jpeg"
  name: string;
  data: string;   // base64 without data: prefix
}>;
```

**Step 3: Build check**

```bash
cd . && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors (or only pre-existing unrelated ones)

**Step 4: Commit**

```bash
git add stores/chat.ts lib/types.ts
git commit -m "feat(chat): extend ChatMessage with Attachment and MessageMetadata types"
```

---

## Task 3: Update use-chat hook to extract metadata

**Files:**
- Modify: `hooks/use-chat.ts`

**Step 1: Update the chat event handler to extract model/provider/usage**

In `hooks/use-chat.ts`, update the `subscribe("chat", ...)` callback. The gateway `ChatEvent` has a `usage` field. Extract it:

Find the block that handles `event.state === "final"` and update `upsertAssistantMessage` call:

```ts
} else if (event.state === "final") {
  setStreaming(false);
  currentRunIdRef.current = null;
  const text = extractText(event.message);
  const usage = event.usage as Record<string, unknown> | undefined;
  const metadata: import("@/stores/chat").MessageMetadata = {
    model: usage?.model as string | undefined,
    provider: usage?.provider as string | undefined,
    inputTokens: usage?.inputTokens as number | undefined,
    outputTokens: usage?.outputTokens as number | undefined,
    rawEvent: event,
  };
  upsertAssistantMessage(event.runId, text || "", "final", metadata);
```

Also update the `delta` case to pass rawEvent for streaming:

```ts
if (event.state === "delta") {
  setStreaming(true);
  currentRunIdRef.current = event.runId;
  const text = extractText(event.message);
  upsertAssistantMessage(event.runId, text, "delta", { rawEvent: event });
```

**Step 2: Update `upsertAssistantMessage` call signature in loadHistory**

In `loadHistory`, when mapping history messages, add metadata extraction:

```ts
const mapped: ChatMessage[] = history.map((h: unknown) => {
  const item = h as Record<string, unknown>;
  const usage = item.usage as Record<string, unknown> | undefined;
  return {
    id: (item.id as string) ?? genId(),
    role: ((item.role as string) ?? "assistant") as "user" | "assistant",
    content: extractText(item),
    timestamp: (item.timestamp as number) ?? Date.now(),
    state: "final" as const,
    metadata: usage ? {
      model: usage.model as string | undefined,
      provider: usage.provider as string | undefined,
      inputTokens: usage.inputTokens as number | undefined,
      outputTokens: usage.outputTokens as number | undefined,
    } : undefined,
  };
});
```

Also add `genId` helper at the top (copy from store) or import:

```ts
function genId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}
```

Remove the existing `generateId` function and use `genId` (or just rename).

**Step 3: Export sendMessage with attachment support**

Update `sendMessage` to accept optional attachments:

```ts
const sendMessage = useCallback(
  async (text: string, attachments?: import("@/stores/chat").Attachment[]) => {
    if (!text.trim() && (!attachments || attachments.length === 0)) return;
    if (!sessionKeyRef.current) return;
    setError(null);

    const userMsg: ChatMessage = {
      id: genId(),
      role: "user",
      content: text,
      timestamp: Date.now(),
      attachments,
    };
    addMessage(userMsg);

    try {
      await rpc("chat.send", {
        sessionKey: sessionKeyRef.current,
        message: text,
        idempotencyKey: genId(),
        attachments: attachments?.map((a) => ({
          type: a.mimeType,
          name: a.name,
          data: a.dataUrl.split(",")[1] ?? a.dataUrl,  // strip data: prefix
        })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    }
  },
  [rpc, addMessage, setError]
);
```

**Step 4: Build check**

```bash
cd . && npx tsc --noEmit 2>&1 | head -20
```

**Step 5: Commit**

```bash
git add hooks/use-chat.ts
git commit -m "feat(chat): extract model/provider metadata from gateway events"
```

---

## Task 4: Create MarkdownMessage component

**Files:**
- Create: `components/chat/markdown-message.tsx`

**Step 1: Create the file**

```tsx
"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import type { Components } from "react-markdown";

// Custom renderers for shadcn/Tailwind styling
const components: Components = {
  // Code blocks
  pre({ children, ...props }) {
    return (
      <pre
        {...props}
        className="bg-muted/60 border border-border rounded-md p-3 overflow-x-auto text-xs font-mono my-2"
      >
        {children}
      </pre>
    );
  },
  code({ children, className, ...props }) {
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return <code className={className} {...props}>{children}</code>;
    }
    return (
      <code
        className="bg-muted px-1 py-0.5 rounded text-xs font-mono"
        {...props}
      >
        {children}
      </code>
    );
  },
  // Paragraphs
  p({ children }) {
    return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>;
  },
  // Lists
  ul({ children }) {
    return <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>;
  },
  li({ children }) {
    return <li className="text-sm">{children}</li>;
  },
  // Headings
  h1({ children }) {
    return <h1 className="text-lg font-bold mt-3 mb-1">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="text-base font-semibold mt-2 mb-1">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>;
  },
  // Blockquote
  blockquote({ children }) {
    return (
      <blockquote className="border-l-2 border-muted-foreground/30 pl-3 text-muted-foreground italic my-2">
        {children}
      </blockquote>
    );
  },
  // Table
  table({ children }) {
    return (
      <div className="overflow-x-auto my-2">
        <table className="text-xs border-collapse w-full">{children}</table>
      </div>
    );
  },
  th({ children }) {
    return (
      <th className="border border-border bg-muted/50 px-2 py-1 text-left font-medium">
        {children}
      </th>
    );
  },
  td({ children }) {
    return (
      <td className="border border-border px-2 py-1">{children}</td>
    );
  },
  // Horizontal rule
  hr() {
    return <hr className="border-border my-3" />;
  },
  // Bold / Italic
  strong({ children }) {
    return <strong className="font-semibold">{children}</strong>;
  },
  em({ children }) {
    return <em className="italic">{children}</em>;
  },
  // Links
  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 hover:opacity-80"
      >
        {children}
      </a>
    );
  },
};

interface MarkdownMessageProps {
  content: string;
}

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  if (!content) return null;
  return (
    <div className="prose-sm max-w-none text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
```

**Step 2: Build check**

```bash
cd . && npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add components/chat/markdown-message.tsx
git commit -m "feat(chat): add MarkdownMessage component with full GFM support"
```

---

## Task 5: Update MessageBubble — markdown + model chip + attachment thumbnails

**Files:**
- Modify: `components/chat/message-bubble.tsx`

**Step 1: Replace the file content**

```tsx
"use client";

import { memo, useState } from "react";
import type { ChatMessage } from "@/stores/chat";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MarkdownMessage } from "./markdown-message";
import { Bot, User, AlertCircle, XCircle, Maximize2 } from "lucide-react";

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Streaming indicator dots */
function StreamingDots() {
  return (
    <span className="inline-flex items-center gap-0.5 ml-1">
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-bounce [animation-delay:0ms]" />
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-bounce [animation-delay:150ms]" />
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 animate-bounce [animation-delay:300ms]" />
    </span>
  );
}

/** Image lightbox (simple overlay) */
function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <img
        src={src}
        alt={alt}
        className="max-w-[90vw] max-h-[90vh] rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

/** Attachment thumbnails inside a bubble */
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
                <img
                  src={att.dataUrl}
                  alt={att.name}
                  className="h-24 w-24 object-cover rounded-md border border-border"
                />
                <div className="absolute inset-0 rounded-md bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <Maximize2 className="w-4 h-4 text-white opacity-0 group-hover:opacity-100" />
                </div>
              </div>
            );
          }
          // Non-image file
          return (
            <a
              key={att.id}
              href={att.dataUrl}
              download={att.name}
              className="flex items-center gap-2 bg-muted/50 border border-border rounded-md px-3 py-2 text-xs hover:bg-muted transition-colors"
            >
              <span className="text-lg">📄</span>
              <div>
                <div className="font-medium truncate max-w-[120px]">{att.name}</div>
                <div className="text-muted-foreground">{(att.size / 1024).toFixed(1)} KB</div>
              </div>
            </a>
          );
        })}
      </div>
      {lightbox && (
        <Lightbox src={lightbox} alt="attachment" onClose={() => setLightbox(null)} />
      )}
    </>
  );
}

/** Small model/provider chip shown under assistant messages */
function ModelChip({
  model,
  provider,
  onClick,
}: {
  model?: string;
  provider?: string;
  onClick?: () => void;
}) {
  if (!model && !provider) return null;
  const label = [model, provider].filter(Boolean).join(" · ");
  return (
    <button
      onClick={onClick}
      title="Click to view raw event"
      className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer"
    >
      {label}
    </button>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  onShowDetails?: (msg: ChatMessage) => void;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  onShowDetails,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isError = message.state === "error";
  const isAborted = message.state === "aborted";
  const isDelta = message.state === "delta";

  if (isUser) {
    return (
      <div className="flex justify-end gap-2">
        <div className="max-w-[75%] space-y-1">
          <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5 text-sm">
            <MarkdownMessage content={message.content} />
            {message.attachments && message.attachments.length > 0 && (
              <AttachmentGrid attachments={message.attachments} />
            )}
          </div>
          <div className="text-[10px] text-muted-foreground text-right px-1">
            {formatTimestamp(message.timestamp)}
          </div>
        </div>
        <Avatar size="sm">
          <AvatarFallback>
            <User className="w-3 h-3" />
          </AvatarFallback>
        </Avatar>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex justify-start gap-2">
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
          ) : (
            <>
              <MarkdownMessage content={message.content} />
              {isDelta && <StreamingDots />}
              {message.attachments && message.attachments.length > 0 && (
                <AttachmentGrid attachments={message.attachments} />
              )}
            </>
          )}
        </div>

        {/* Timestamp + model chip row */}
        <div className="flex items-center justify-between px-1">
          <div className="text-[10px] text-muted-foreground">
            {formatTimestamp(message.timestamp)}
            {isAborted && (
              <span className="text-muted-foreground/60 ml-1">(aborted)</span>
            )}
          </div>
          <ModelChip
            model={message.metadata?.model}
            provider={message.metadata?.provider}
            onClick={() => onShowDetails?.(message)}
          />
        </div>
      </div>
    </div>
  );
});
```

**Step 2: Build check**

```bash
cd . && npx tsc --noEmit 2>&1 | head -30
```

**Step 3: Commit**

```bash
git add components/chat/message-bubble.tsx
git commit -m "feat(chat): markdown rendering, attachment thumbnails, model/provider chip"
```

---

## Task 6: Create DetailsPanel component

**Files:**
- Create: `components/chat/details-panel.tsx`

**Step 1: Create the file**

```tsx
"use client";

import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGatewayStore } from "@/stores/gateway";
import type { ChatMessage, MessageMetadata } from "@/stores/chat";
import type { SessionSummary } from "@/lib/types";
import { Bot, Hash, DollarSign, Zap, ChevronDown, ChevronRight } from "lucide-react";

// ─── Tool Call Accordion ──────────────────────────────────────────────────────

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

// ─── Row helper ───────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs text-right font-medium break-all">{value}</span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

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
  const rpc = useGatewayStore((s) => s.rpc);
  const isConnected = useGatewayStore((s) => s.state === "connected");
  const [session, setSession] = useState<SessionSummary | null>(null);
  const [activeTab, setActiveTab] = useState("session");

  // Load session summary
  useEffect(() => {
    if (!open || !sessionKey || !isConnected) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await rpc("sessions.list", { limit: 500 });
        const found = (result?.sessions ?? []).find((s) => s.key === sessionKey);
        if (!cancelled && found) setSession(found);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [open, sessionKey, isConnected, rpc]);

  // When a focused message is set, switch to Raw tab
  useEffect(() => {
    if (focusedMessage) setActiveTab("raw");
  }, [focusedMessage]);

  // Aggregate token counts across all messages
  const totalInput = allMessages.reduce((sum, m) => sum + (m.metadata?.inputTokens ?? 0), 0);
  const totalOutput = allMessages.reduce((sum, m) => sum + (m.metadata?.outputTokens ?? 0), 0);

  // Collect all tool calls from all messages
  const allToolCalls = allMessages.flatMap((m) => m.metadata?.toolCalls ?? []);

  // The raw event to show (focused message or last assistant message)
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
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
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

          {/* Session tab */}
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
                <InfoRow label="Model" value={session?.model} />
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
                <InfoRow label="Input tokens" value={session?.inputTokens?.toLocaleString()} />
                <InfoRow label="Output tokens" value={session?.outputTokens?.toLocaleString()} />
                <InfoRow label="Total tokens" value={session?.totalTokens?.toLocaleString()} />
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Tokens tab */}
          <TabsContent value="tokens" className="flex-1 overflow-hidden mt-0">
            <ScrollArea className="h-full">
              <div className="px-4 py-3 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/40 rounded-lg p-3 space-y-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Zap className="w-3 h-3" /> Input
                    </div>
                    <div className="text-lg font-bold">{(totalInput || session?.inputTokens || 0).toLocaleString()}</div>
                    <div className="text-[10px] text-muted-foreground">tokens</div>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3 space-y-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Hash className="w-3 h-3" /> Output
                    </div>
                    <div className="text-lg font-bold">{(totalOutput || session?.outputTokens || 0).toLocaleString()}</div>
                    <div className="text-[10px] text-muted-foreground">tokens</div>
                  </div>
                </div>

                {/* Per-message breakdown */}
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

          {/* Tools tab */}
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

          {/* Raw tab */}
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
```

**Step 2: Build check**

```bash
cd . && npx tsc --noEmit 2>&1 | head -30
```

**Step 3: Commit**

```bash
git add components/chat/details-panel.tsx
git commit -m "feat(chat): add DetailsPanel with Session/Tokens/Tools/Raw tabs"
```

---

## Task 7: Update ChatHeader — Details + Search toggles

**Files:**
- Modify: `components/chat/chat-header.tsx`

**Step 1: Add props and buttons to ChatHeader**

Replace full file content:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useGatewayStore } from "@/stores/gateway";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bot, Hash, MessageCircle, PanelRight, Search } from "lucide-react";

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

interface ChatHeaderProps {
  sessionKey: string;
  detailsOpen: boolean;
  searchOpen: boolean;
  onToggleDetails: () => void;
  onToggleSearch: () => void;
}

export function ChatHeader({
  sessionKey,
  detailsOpen,
  searchOpen,
  onToggleDetails,
  onToggleSearch,
}: ChatHeaderProps) {
  const rpc = useGatewayStore((s) => s.rpc);
  const isConnected = useGatewayStore((s) => s.state === "connected");
  const [agentId, setAgentId] = useState<string | null>(null);

  const { channel, id } = parseSessionKey(sessionKey);

  useEffect(() => {
    if (!isConnected || !sessionKey) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await rpc("sessions.resolve", { key: sessionKey });
        if (!cancelled && result?.agentId) setAgentId(result.agentId);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [rpc, isConnected, sessionKey]);

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
          <span className="flex items-center gap-1 truncate font-mono text-[10px] opacity-60">
            <MessageCircle className="w-3 h-3" />
            {sessionKey}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
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
```

**Step 2: Build check**

```bash
cd . && npx tsc --noEmit 2>&1 | head -30
```

**Step 3: Commit**

```bash
git add components/chat/chat-header.tsx
git commit -m "feat(chat): add Details and Search toggle buttons to ChatHeader"
```

---

## Task 8: Create MessageSearch component

**Files:**
- Create: `components/chat/message-search.tsx`

**Step 1: Create the file**

```tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronUp, ChevronDown, X } from "lucide-react";
import type { ChatMessage } from "@/stores/chat";

interface MessageSearchProps {
  open: boolean;
  messages: ChatMessage[];
  onClose: () => void;
  onMatchFocus: (messageId: string) => void;
}

export function MessageSearch({ open, messages, onClose, onMatchFocus }: MessageSearchProps) {
  const [query, setQuery] = useState("");
  const [matchIds, setMatchIds] = useState<string[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setMatchIds([]);
      setCurrentIdx(0);
    }
  }, [open]);

  // Keyboard shortcut Ctrl+F / Cmd+F
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        if (!open) onMatchFocus(""); // will be handled by parent to open
      }
      if (e.key === "Escape" && open) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, onMatchFocus]);

  // Search messages when query changes
  useEffect(() => {
    if (!query.trim()) {
      setMatchIds([]);
      setCurrentIdx(0);
      return;
    }
    const q = query.toLowerCase();
    const ids = messages
      .filter((m) => m.content.toLowerCase().includes(q))
      .map((m) => m.id);
    setMatchIds(ids);
    setCurrentIdx(0);
    if (ids.length > 0) onMatchFocus(ids[0]);
  }, [query, messages, onMatchFocus]);

  const goNext = useCallback(() => {
    if (matchIds.length === 0) return;
    const next = (currentIdx + 1) % matchIds.length;
    setCurrentIdx(next);
    onMatchFocus(matchIds[next]);
  }, [matchIds, currentIdx, onMatchFocus]);

  const goPrev = useCallback(() => {
    if (matchIds.length === 0) return;
    const prev = (currentIdx - 1 + matchIds.length) % matchIds.length;
    setCurrentIdx(prev);
    onMatchFocus(matchIds[prev]);
  }, [matchIds, currentIdx, onMatchFocus]);

  if (!open) return null;

  return (
    <div className="border-b border-border bg-card/80 backdrop-blur-sm px-4 py-2 flex items-center gap-2 shrink-0">
      <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.shiftKey ? goPrev() : goNext();
        }}
        placeholder="Search messages..."
        className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 p-0 flex-1"
      />
      {query && (
        <span className="text-xs text-muted-foreground shrink-0">
          {matchIds.length > 0 ? `${currentIdx + 1}/${matchIds.length}` : "No matches"}
        </span>
      )}
      <Button variant="ghost" size="icon-sm" onClick={goPrev} disabled={matchIds.length === 0}>
        <ChevronUp className="w-3.5 h-3.5" />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={goNext} disabled={matchIds.length === 0}>
        <ChevronDown className="w-3.5 h-3.5" />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={onClose}>
        <X className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
```

**Step 2: Build check**

```bash
cd . && npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add components/chat/message-search.tsx
git commit -m "feat(chat): add MessageSearch component with Ctrl+F support"
```

---

## Task 9: Update ChatInput — attachment support

**Files:**
- Modify: `components/chat/chat-input.tsx`

**Step 1: Replace the full file content**

```tsx
"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type KeyboardEvent,
  type DragEvent,
  type ClipboardEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { Send, Square, Paperclip, X, Image as ImageIcon } from "lucide-react";
import type { Attachment } from "@/stores/chat";

function genId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

async function fileToAttachment(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        id: genId(),
        name: file.name,
        mimeType: file.type,
        size: file.size,
        dataUrl: reader.result as string,
        isImage: file.type.startsWith("image/"),
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface ChatInputProps {
  onSend: (text: string, attachments?: Attachment[]) => void;
  onAbort: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export function ChatInput({
  onSend,
  onAbort,
  isStreaming,
  disabled = false,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const addFiles = useCallback(async (files: File[]) => {
    const results = await Promise.all(files.map(fileToAttachment));
    setAttachments((prev) => [...prev, ...results]);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Drag and drop
  const onDragOver = (e: DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) await addFiles(files);
  };

  // Paste image
  const onPaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.files).filter((f) =>
      f.type.startsWith("image/")
    );
    if (files.length > 0) {
      e.preventDefault();
      await addFiles(files);
    }
  };

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if ((!trimmed && attachments.length === 0) || disabled) return;
    onSend(trimmed, attachments.length > 0 ? attachments : undefined);
    setValue("");
    setAttachments([]);
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    });
  }, [value, attachments, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (isStreaming) return;
        handleSend();
      }
    },
    [handleSend, isStreaming]
  );

  const canSend = (value.trim().length > 0 || attachments.length > 0) && !isStreaming && !disabled;

  return (
    <div
      className={`border-t border-border bg-card/50 transition-colors ${dragging ? "bg-primary/5 border-primary/30" : ""}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Attachment preview strip */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pt-3">
          {attachments.map((att) => (
            <div key={att.id} className="relative group">
              {att.isImage ? (
                <img
                  src={att.dataUrl}
                  alt={att.name}
                  className="h-16 w-16 object-cover rounded-md border border-border"
                />
              ) : (
                <div className="h-16 w-20 flex flex-col items-center justify-center rounded-md border border-border bg-muted/40 px-2">
                  <span className="text-xl">📄</span>
                  <span className="text-[10px] text-muted-foreground truncate w-full text-center mt-1">
                    {att.name}
                  </span>
                </div>
              )}
              <button
                onClick={() => removeAttachment(att.id)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 p-3 max-w-4xl mx-auto">
        {/* Attach file button */}
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-muted-foreground mb-0.5"
          title="Attach file"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="w-4 h-4" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) await addFiles(files);
            e.target.value = "";
          }}
        />

        {/* Image-only picker */}
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-muted-foreground mb-0.5"
          title="Attach image"
          disabled={disabled}
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";
            input.multiple = true;
            input.onchange = async () => {
              const files = Array.from(input.files ?? []);
              if (files.length > 0) await addFiles(files);
            };
            input.click();
          }}
        >
          <ImageIcon className="w-4 h-4" />
        </Button>

        {/* Auto-resize textarea */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={onPaste}
            placeholder={
              disabled
                ? "Select a session to start chatting..."
                : dragging
                  ? "Drop files here..."
                  : "Type a message... (Shift+Enter for new line)"
            }
            disabled={disabled}
            rows={1}
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ minHeight: "40px", maxHeight: "160px" }}
          />
        </div>

        {/* Send or Abort */}
        {isStreaming ? (
          <Button
            variant="destructive"
            size="icon-sm"
            onClick={onAbort}
            className="shrink-0 mb-0.5"
            title="Stop generating"
          >
            <Square className="w-3.5 h-3.5" />
          </Button>
        ) : (
          <Button
            variant="default"
            size="icon-sm"
            onClick={handleSend}
            disabled={!canSend}
            className="shrink-0 mb-0.5"
            title="Send"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Build check**

```bash
cd . && npx tsc --noEmit 2>&1 | head -30
```

**Step 3: Commit**

```bash
git add components/chat/chat-input.tsx
git commit -m "feat(chat): file/image attachment support with drag-drop and paste"
```

---

## Task 10: Wire everything in chat/page.tsx

**Files:**
- Modify: `app/chat/page.tsx`

**Step 1: Replace `ChatPageInner` with wired version**

The inner component needs to:
1. Pass `detailsOpen`, `searchOpen`, toggle handlers to `ChatHeader`
2. Render `DetailsPanel` with sessionKey + messages
3. Render `MessageSearch` above messages
4. Pass `onShowDetails` to `MessageBubble` via messages area
5. Pass `onSend(text, attachments)` to `ChatInput`
6. Add `useRef` for focused message element (for scroll-to)

Replace the file:

```tsx
"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useChat } from "@/hooks/use-chat";
import { SessionList } from "@/components/chat/session-list";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatHeader } from "@/components/chat/chat-header";
import { AgentSelector } from "@/components/chat/agent-selector";
import { DetailsPanel } from "@/components/chat/details-panel";
import { MessageSearch } from "@/components/chat/message-search";
import { MessageSquare, WifiOff } from "lucide-react";
import type { ChatMessage } from "@/stores/chat";

function ChatPageInner() {
  const searchParams = useSearchParams();
  const initialSession = searchParams?.get("session") ?? null;

  const {
    messages,
    isStreaming,
    error,
    activeSessionKey,
    isConnected,
    sendMessage,
    abort,
    switchSession,
  } = useChat();

  const [showAgentSelector, setShowAgentSelector] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [focusedMessage, setFocusedMessage] = useState<ChatMessage | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Auto-select session from URL param
  useEffect(() => {
    if (initialSession && !activeSessionKey) {
      switchSession(initialSession);
    }
  }, [initialSession, activeSessionKey, switchSession]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 50;
  }, []);

  const handleNewChat = useCallback(
    (_agentId: string) => {
      const key = `webchat:fcdash:${Date.now()}`;
      switchSession(key);
      setShowAgentSelector(false);
    },
    [switchSession]
  );

  // When a model chip is clicked, open details panel on Raw tab
  const handleShowDetails = useCallback((msg: ChatMessage) => {
    setFocusedMessage(msg);
    setDetailsOpen(true);
  }, []);

  // When search focuses a match, scroll to that message
  const handleMatchFocus = useCallback((messageId: string) => {
    setHighlightedId(messageId);
    const el = messageRefs.current.get(messageId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  // Ctrl+F keyboard shortcut
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex h-full">
      {/* Session sidebar */}
      <SessionList
        activeKey={activeSessionKey}
        onSelect={(key) => {
          switchSession(key);
          setFocusedMessage(null);
          setDetailsOpen(false);
          setSearchOpen(false);
        }}
        onNewChat={() => setShowAgentSelector(true)}
      />

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Connection warning */}
        {!isConnected && (
          <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground bg-muted/50 border-b border-border">
            <WifiOff className="w-3.5 h-3.5" />
            <span>Not connected to gateway. Chat features are unavailable.</span>
          </div>
        )}

        {activeSessionKey ? (
          <>
            <ChatHeader
              sessionKey={activeSessionKey}
              detailsOpen={detailsOpen}
              searchOpen={searchOpen}
              onToggleDetails={() => setDetailsOpen((v) => !v)}
              onToggleSearch={() => setSearchOpen((v) => !v)}
            />

            {/* Search bar */}
            <MessageSearch
              open={searchOpen}
              messages={messages}
              onClose={() => setSearchOpen(false)}
              onMatchFocus={handleMatchFocus}
            />

            {/* Messages area */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
            >
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm">No messages yet. Start the conversation.</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    ref={(el) => {
                      if (el) messageRefs.current.set(msg.id, el);
                      else messageRefs.current.delete(msg.id);
                    }}
                    className={`transition-colors rounded-lg ${
                      highlightedId === msg.id ? "bg-primary/5 ring-1 ring-primary/20" : ""
                    }`}
                  >
                    <MessageBubble
                      message={msg}
                      onShowDetails={handleShowDetails}
                    />
                  </div>
                ))
              )}
            </div>

            {/* Error bar */}
            {error && (
              <div className="px-4 py-2 text-xs text-destructive bg-destructive/10 border-t border-destructive/20">
                {error}
              </div>
            )}

            {/* Input */}
            <ChatInput
              onSend={sendMessage}
              onAbort={abort}
              isStreaming={isStreaming}
              disabled={!activeSessionKey || !isConnected}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MessageSquare className="w-16 h-16 mb-4 opacity-10" />
            <h2 className="text-lg font-medium mb-1">Select a session</h2>
            <p className="text-sm">Choose a session from the sidebar or start a new chat</p>
          </div>
        )}
      </div>

      {/* Details panel (slide-over) */}
      <DetailsPanel
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        sessionKey={activeSessionKey}
        focusedMessage={focusedMessage}
        allMessages={messages}
      />

      {/* Agent selector */}
      <AgentSelector
        open={showAgentSelector}
        onClose={() => setShowAgentSelector(false)}
        onSelect={handleNewChat}
      />
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatPageInner />
    </Suspense>
  );
}
```

**Step 2: Full build check**

```bash
cd . && npx next build 2>&1 | tail -20
```
Expected: all routes compile cleanly

**Step 3: Commit**

```bash
git add app/chat/page.tsx
git commit -m "feat(chat): wire DetailsPanel, MessageSearch, and attachment support into ChatPage"
```

---

## Task 11: Final verification

**Step 1: Start dev server and smoke-test**

```bash
cd . && npm run dev
```

Check:
- `/chat` loads without errors
- Sending a message works
- Clicking [PanelRight] button opens Details panel from right
- Details panel shows Session tab with session info
- Clicking model chip on a message switches to Raw tab
- Ctrl+F opens search bar, typing highlights matching messages
- Clicking 📎 opens file picker
- Dragging a file onto the input area shows preview
- Pasting an image from clipboard shows preview
- Markdown renders: **bold**, `code`, tables, lists in messages

**Step 2: Final commit**

```bash
git add -A
git commit -m "feat: advanced chat UI - markdown, attachments, details panel, search"
```
