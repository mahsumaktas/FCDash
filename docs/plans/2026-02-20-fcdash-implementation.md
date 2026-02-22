# FCDash Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite the OpenClaw dashboard from scratch as FCDash (Full Control Dashboard) with modern UI, full API coverage, and session-continuation chat.

**Architecture:** Next.js 16 App Router with shadcn/ui components, Zustand for state, WebSocket gateway client for real-time communication. Chat is the primary feature with sidebar session list + agent selection.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.7 strict, shadcn/ui, Tailwind CSS v4, Framer Motion, Zustand, cmdk, Recharts, Sonner, Lucide React

**Reference Files:**
- Design doc: `docs/plans/2026-02-20-fcdash-redesign-design.md`
- Existing gateway client: `lib/gateway-client.ts` (port + improve)
- Existing types: `lib/types.ts` (extend to all 91 methods)
- Existing chat hook: `hooks/use-openclaw-chat.ts` (logic reference)
- Gateway source: `&lt;openclaw-gateway&gt;/src/gateway/server-methods/`
- Env config: `.env.local` (keep as-is)

---

## Phase 1: Project Scaffold

### Task 1: Create fresh Next.js project in new branch

**Files:**
- Create: all scaffolded files
- Keep: `.env.local`, `.git/`, `docs/`

**Step 1: Create branch and clean workspace**

```bash
cd .
git checkout -b fcdash-rewrite
```

**Step 2: Remove old source files (keep git, env, docs)**

```bash
# Remove old source directories
rm -rf app/ components/ contexts/ hooks/ lib/ public/favicon.ico styles/
rm -f next.config.ts tsconfig.json postcss.config.mjs tailwind.config.ts package.json package-lock.json pnpm-lock.yaml
rm -rf node_modules/ .next/
```

**Step 3: Initialize fresh Next.js 16 project**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --turbopack --yes
```

Note: If create-next-app complains about existing files, use `--force` or manually scaffold with `npm init -y` + install deps.

**Step 4: Update package.json name and description**

Set name to `fcdash`, description to `FCDash - Full Control Dashboard for OpenClaw`.

**Step 5: Install additional dependencies**

```bash
npm install zustand framer-motion cmdk recharts sonner
npm install -D @types/node
```

**Step 6: Initialize shadcn/ui**

```bash
npx shadcn@latest init
```

Select: New York style, Zinc base color, CSS variables enabled.

**Step 7: Add core shadcn/ui components**

```bash
npx shadcn@latest add button card dialog input label select separator sheet tabs textarea tooltip badge avatar dropdown-menu command scroll-area skeleton switch popover
```

**Step 8: Verify dev server starts**

```bash
npm run dev
```

Open http://localhost:3000 — should show Next.js default page.

**Step 9: Commit**

```bash
git add -A && git commit -m "feat: scaffold FCDash with Next.js 16, shadcn/ui, and core deps"
```

---

### Task 2: Configure theme and global styles

**Files:**
- Modify: `app/globals.css`
- Modify: `tailwind.config.ts` (if needed for shadcn)
- Create: `lib/utils.ts`

**Step 1: Set up dark-first theme in globals.css**

Replace globals.css with FCDash theme using CSS variables:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --card: 240 10% 5.9%;
    --card-foreground: 0 0% 98%;
    --popover: 240 10% 5.9%;
    --popover-foreground: 0 0% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 240 3.7% 15.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;
    --accent: 240 3.7% 15.9%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 3.7% 15.9%;
    --input: 240 3.7% 15.9%;
    --ring: 217.2 91.2% 59.8%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}

/* Custom scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: hsl(var(--muted-foreground) / 0.3); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: hsl(var(--muted-foreground) / 0.5); }
```

**Step 2: Ensure lib/utils.ts has cn() helper**

shadcn init should create this. Verify it contains:

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Step 3: Set dark mode as default in layout.tsx**

In `app/layout.tsx`, add `className="dark"` to the `<html>` tag.

**Step 4: Verify styling works**

```bash
npm run dev
```

Page should have dark background.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: configure dark-first theme and shadcn/ui styles"
```

---

## Phase 2: Core Infrastructure

### Task 3: Port and improve gateway client

**Files:**
- Create: `lib/gateway-client.ts`
- Reference: existing `lib/gateway-client.ts` from main branch

**Step 1: Create improved gateway client**

Port from existing with these improvements:
- Use `crypto.getRandomValues` fallback for UUID (non-secure context fix from previous session)
- Add cursor tracking for logs.tail
- Better TypeScript generics
- Remove `as never` casts

The client class stays largely the same — `GatewayClient` with connect/disconnect/rpc/on methods. Key code to keep:
- WebSocket connection with exponential backoff (800ms → 15s)
- RPC request/response correlation with 30s timeout
- Event listener subscription pattern
- Connect challenge (nonce) support
- Sequence gap detection
- UUID fallback: `typeof crypto.randomUUID === "function" ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16))).map(...).join("")`

**Step 2: Verify file compiles**

```bash
npx tsc --noEmit lib/gateway-client.ts
```

**Step 3: Commit**

```bash
git add lib/gateway-client.ts && git commit -m "feat: port gateway WebSocket client with UUID fallback"
```

---

### Task 4: Create comprehensive type definitions

**Files:**
- Create: `lib/types.ts`
- Reference: existing `lib/types.ts` from main branch + gateway source

**Step 1: Create types.ts with ALL gateway types**

Port existing types and add missing ones:

**New types to add:**
- `AgentFilesListResult`, `AgentFileContent`
- `ExecApprovalRequest`, `ExecApprovalResolve`, `ExecApprovalSettings`
- `WizardStatus`, `WizardStep`
- `UsageStatus`, `UsageCost`
- `SystemPresence`, `SystemEvent`

**New RPC methods to add to RPCMethodMap:**
- `"agent"` — main agent message handler
- `"agents.files.list"`, `"agents.files.get"`, `"agents.files.set"`
- `"exec.approval.request"`, `"exec.approval.resolve"`
- `"exec.approvals.get"`, `"exec.approvals.set"`
- `"sessions.resolve"`
- `"config.apply"`, `"config.patch"`
- `"device.token.rotate"`, `"device.token.revoke"`
- `"node.pair.request"`, `"node.pair.list"`, `"node.pair.approve"`, `"node.pair.reject"`
- `"wizard.start"`, `"wizard.next"`, `"wizard.cancel"`, `"wizard.status"`
- `"usage.status"`, `"usage.cost"`
- `"update.run"`

**Fix `chat.history` return type:**
```typescript
"chat.history": [
  { sessionKey: string; limit?: number },
  { sessionKey: string; sessionId: string; messages: ChatHistoryMessage[]; thinkingLevel?: string; verboseLevel?: string }
];
```

**Step 2: Verify types compile**

```bash
npx tsc --noEmit lib/types.ts
```

**Step 3: Commit**

```bash
git add lib/types.ts && git commit -m "feat: comprehensive type definitions for all 91 gateway methods"
```

---

### Task 5: Create Zustand stores

**Files:**
- Create: `stores/gateway.ts`
- Create: `stores/chat.ts`
- Create: `stores/notifications.ts`

**Step 1: Create gateway store**

```typescript
// stores/gateway.ts
import { create } from "zustand";
import { GatewayClient, type GatewayClientOptions } from "@/lib/gateway-client";
import type { GatewayConnectionState, HelloOk, Snapshot, GatewayEventName, GatewayEventMap, RPCMethodMap, RPCParams, RPCResult } from "@/lib/types";

interface GatewayStore {
  client: GatewayClient | null;
  state: GatewayConnectionState;
  hello: HelloOk | null;
  snapshot: Snapshot | null;
  error: Error | null;

  init: (opts: GatewayClientOptions) => void;
  connect: () => void;
  disconnect: () => void;
  rpc: <M extends keyof RPCMethodMap>(method: M, ...args: RPCParams<M> extends void ? [] : [RPCParams<M>]) => Promise<RPCResult<M>>;
  subscribe: <E extends GatewayEventName>(event: E, cb: (payload: GatewayEventMap[E]) => void) => () => void;
}

export const useGatewayStore = create<GatewayStore>((set, get) => ({
  client: null,
  state: "disconnected",
  hello: null,
  snapshot: null,
  error: null,

  init: (opts) => {
    const client = new GatewayClient({
      ...opts,
      onStateChange: (state) => set({ state }),
      onHello: (hello) => set({ hello, snapshot: hello.snapshot }),
      onError: (error) => set({ error }),
    });
    set({ client });
  },

  connect: () => get().client?.connect(),
  disconnect: () => get().client?.disconnect(),

  rpc: async (method, ...args) => {
    const client = get().client;
    if (!client) throw new Error("Gateway not initialized");
    return client.rpc(method, ...args);
  },

  subscribe: (event, cb) => {
    const client = get().client;
    if (!client) return () => {};
    return client.on(event, cb);
  },
}));
```

**Step 2: Create chat store**

```typescript
// stores/chat.ts
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
  updateMessage: (runId: string, update: Partial<ChatMessage>) => void;
  upsertAssistantMessage: (runId: string, content: string, state: ChatMessage["state"]) => void;
  setStreaming: (v: boolean) => void;
  setError: (e: string | null) => void;
  clear: () => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  activeSessionKey: null,
  messages: [],
  isStreaming: false,
  error: null,

  setActiveSession: (key) => set({ activeSessionKey: key, messages: [], error: null }),
  setMessages: (messages) => set({ messages }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  updateMessage: (runId, update) => set((s) => ({
    messages: s.messages.map((m) => m.runId === runId && m.role === "assistant" ? { ...m, ...update } : m),
  })),
  upsertAssistantMessage: (runId, content, state) => set((s) => {
    const existing = s.messages.find((m) => m.runId === runId && m.role === "assistant");
    if (existing) {
      return { messages: s.messages.map((m) => m.runId === runId && m.role === "assistant" ? { ...m, content, state } : m) };
    }
    return {
      messages: [...s.messages, {
        id: crypto.randomUUID?.() ?? Math.random().toString(36),
        role: "assistant",
        content,
        timestamp: Date.now(),
        state,
        runId,
      }],
    };
  }),
  setStreaming: (isStreaming) => set({ isStreaming }),
  setError: (error) => set({ error }),
  clear: () => set({ messages: [], error: null, isStreaming: false }),
}));
```

**Step 3: Create notifications store**

```typescript
// stores/notifications.ts
import { create } from "zustand";

export interface ApprovalNotification {
  id: string;
  command: string;
  agentId?: string;
  sessionKey?: string;
  timestamp: number;
}

interface NotificationStore {
  pendingApprovals: ApprovalNotification[];
  addApproval: (a: ApprovalNotification) => void;
  removeApproval: (id: string) => void;
  clearApprovals: () => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  pendingApprovals: [],
  addApproval: (a) => set((s) => ({ pendingApprovals: [...s.pendingApprovals, a] })),
  removeApproval: (id) => set((s) => ({ pendingApprovals: s.pendingApprovals.filter((p) => p.id !== id) })),
  clearApprovals: () => set({ pendingApprovals: [] }),
}));
```

**Step 4: Verify stores compile**

```bash
npx tsc --noEmit stores/gateway.ts stores/chat.ts stores/notifications.ts
```

**Step 5: Commit**

```bash
git add stores/ && git commit -m "feat: Zustand stores for gateway, chat, and notifications"
```

---

### Task 6: Create gateway provider and hooks

**Files:**
- Create: `components/providers.tsx`
- Create: `hooks/use-gateway.ts`
- Create: `hooks/use-rpc.ts`
- Create: `hooks/use-event.ts`

**Step 1: Create providers component**

Wrap app with gateway auto-connect, Sonner toaster, and Framer Motion.

```typescript
// components/providers.tsx
"use client";

import { useEffect } from "react";
import { Toaster } from "sonner";
import { useGatewayStore } from "@/stores/gateway";

export function Providers({ children }: { children: React.ReactNode }) {
  const init = useGatewayStore((s) => s.init);
  const connect = useGatewayStore((s) => s.connect);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_URL ?? `ws://${window.location.hostname}:28643`;
    const token = process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_TOKEN;
    init({ url, token });
    connect();
  }, [init, connect]);

  return (
    <>
      {children}
      <Toaster position="bottom-right" theme="dark" richColors />
    </>
  );
}
```

**Step 2: Create typed hooks**

```typescript
// hooks/use-gateway.ts
"use client";
import { useGatewayStore } from "@/stores/gateway";

export function useGateway() {
  return useGatewayStore();
}

export function useIsConnected() {
  return useGatewayStore((s) => s.state === "connected");
}
```

```typescript
// hooks/use-rpc.ts
"use client";
import { useState, useCallback } from "react";
import { useGatewayStore } from "@/stores/gateway";
import type { RPCMethodMap, RPCParams, RPCResult } from "@/lib/types";

export function useRpc<M extends keyof RPCMethodMap>(method: M) {
  const rpc = useGatewayStore((s) => s.rpc);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = useCallback(async (...args: RPCParams<M> extends void ? [] : [RPCParams<M>]) => {
    setLoading(true);
    setError(null);
    try {
      const result = await rpc(method, ...args);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "RPC failed";
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [rpc, method]);

  return { call, loading, error };
}
```

```typescript
// hooks/use-event.ts
"use client";
import { useEffect } from "react";
import { useGatewayStore } from "@/stores/gateway";
import type { GatewayEventName, GatewayEventMap } from "@/lib/types";

export function useEvent<E extends GatewayEventName>(
  event: E,
  callback: (payload: GatewayEventMap[E]) => void,
  enabled = true
) {
  const subscribe = useGatewayStore((s) => s.subscribe);
  const isConnected = useGatewayStore((s) => s.state === "connected");

  useEffect(() => {
    if (!isConnected || !enabled) return;
    return subscribe(event, callback);
  }, [isConnected, enabled, event, callback, subscribe]);
}
```

**Step 3: Commit**

```bash
git add components/providers.tsx hooks/ && git commit -m "feat: gateway provider and typed RPC/event hooks"
```

---

## Phase 3: Layout Shell

### Task 7: Create app layout with sidebar

**Files:**
- Modify: `app/layout.tsx`
- Create: `components/layout/app-sidebar.tsx`
- Create: `components/layout/app-header.tsx`
- Create: `lib/constants.ts`

**Step 1: Create constants with navigation items**

```typescript
// lib/constants.ts
import {
  LayoutDashboard, MessageSquare, Bot, List, Shield,
  Cpu, Radio, Wrench, Clock, Server, Mic, Settings,
  ScrollText, BarChart3,
} from "lucide-react";

export const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/sessions", label: "Sessions", icon: List },
  { href: "/approvals", label: "Approvals", icon: Shield, badge: true },
  { href: "/models", label: "Models", icon: Cpu },
  { href: "/channels", label: "Channels", icon: Radio },
  { href: "/skills", label: "Skills", icon: Wrench },
  { href: "/cron", label: "Cron", icon: Clock },
  { href: "/nodes", label: "Nodes", icon: Server },
  { href: "/voice", label: "Voice", icon: Mic },
  { href: "/config", label: "Config", icon: Settings },
  { href: "/logs", label: "Logs", icon: ScrollText },
  { href: "/usage", label: "Usage", icon: BarChart3 },
] as const;
```

**Step 2: Create sidebar component**

Use shadcn/ui Sheet for mobile, fixed sidebar for desktop. Show:
- FCDash logo/title
- Connection status dot (green/yellow/red)
- Nav items with active highlighting
- Pending approvals badge count

**Step 3: Create header component**

Show:
- Current page title (from route)
- Cmd+K button to open command palette
- Connection status text

**Step 4: Wire up layout.tsx**

```typescript
// app/layout.tsx
import { Providers } from "@/components/providers";
import { AppSidebar } from "@/components/layout/app-sidebar";
import "./globals.css";

export const metadata = { title: "FCDash", description: "Full Control Dashboard for OpenClaw" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <Providers>
          <div className="flex h-screen">
            <AppSidebar />
            <main className="flex-1 overflow-hidden">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
```

**Step 5: Verify layout renders**

```bash
npm run dev
```

Should see sidebar with nav items and main content area.

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: app layout with sidebar navigation and header"
```

---

### Task 8: Create command palette (Cmd+K)

**Files:**
- Create: `components/layout/command-palette.tsx`
- Modify: `components/providers.tsx` (add command palette)

**Step 1: Create command palette with cmdk**

Features:
- Open with Cmd+K
- Search pages by name
- Search agents (from gateway store)
- Navigate to page on select
- Close on Escape or select

**Step 2: Wire into providers**

Add `<CommandPalette />` component inside Providers.

**Step 3: Verify Cmd+K opens palette**

```bash
npm run dev
```

Press Cmd+K — palette should open.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: Cmd+K command palette for quick navigation"
```

---

## Phase 4: Chat Page (Primary Feature)

### Task 9: Create session list sidebar component

**Files:**
- Create: `components/chat/session-list.tsx`

**Step 1: Create session list component**

Features:
- Fetch sessions via `sessions.list` RPC
- Group by channel (Telegram, WhatsApp, Web, etc.)
- Each row: agent emoji, display name or session key, last updated time
- Search/filter input
- Active session highlighted
- Click to select session (calls onSelect prop)
- "New Chat" button at top

Props:
```typescript
interface SessionListProps {
  activeKey: string | null;
  onSelect: (key: string) => void;
  onNewChat: () => void;
}
```

**Step 2: Commit**

```bash
git add components/chat/ && git commit -m "feat: chat session list sidebar component"
```

---

### Task 10: Create chat message components

**Files:**
- Create: `components/chat/message-bubble.tsx`
- Create: `components/chat/chat-input.tsx`
- Create: `components/chat/chat-header.tsx`

**Step 1: Create message bubble**

Features:
- User messages: right-aligned, primary color background
- Assistant messages: left-aligned, card background
- Agent emoji/avatar beside assistant messages
- Timestamp below message
- Streaming indicator (animated dots) for delta state
- Error/aborted state styling
- Markdown rendering for assistant messages (basic: bold, italic, code blocks, links)

**Step 2: Create chat input**

Features:
- Textarea with auto-resize
- Send button (enabled when text present and not streaming)
- Abort button (visible during streaming)
- Mic button for speech-to-text
- Submit on Enter (Shift+Enter for newline)

**Step 3: Create chat header**

Features:
- Agent emoji and name
- Session key display
- Model badge
- Back button (mobile)

**Step 4: Commit**

```bash
git add components/chat/ && git commit -m "feat: chat message bubble, input, and header components"
```

---

### Task 11: Create agent selector modal

**Files:**
- Create: `components/chat/agent-selector.tsx`

**Step 1: Create agent selector**

Features:
- Dialog/modal using shadcn Dialog
- Fetch agents via `agents.list` RPC
- Show each agent as card: emoji, name, default badge
- Click agent to create new chat session
- Session key format: `webchat:fcdash:TIMESTAMP` or user-chosen

**Step 2: Commit**

```bash
git add components/chat/agent-selector.tsx && git commit -m "feat: agent selector modal for new chats"
```

---

### Task 12: Create chat page with full session continuation

**Files:**
- Create: `app/chat/page.tsx`
- Create: `hooks/use-chat.ts`

**Step 1: Create use-chat hook**

Port logic from existing `hooks/use-openclaw-chat.ts` but use Zustand store:
- `sendMessage(text)` — add user msg to store, call `chat.send` RPC
- `loadHistory(sessionKey)` — call `chat.history`, parse messages, update store
- `abort()` — call `chat.abort`
- Subscribe to `chat` events — update store on delta/final/error
- `extractText()` helper — same as existing (handles content arrays, thinking blocks)
- When `activeSessionKey` changes, clear messages and load history

**Step 2: Create chat page**

Layout:
```
┌──────────┬──────────────────────────────────────────┐
│ Sessions │ ChatHeader                               │
│ (280px)  │──────────────────────────────────────────│
│          │ Messages (scroll)                        │
│          │                                          │
│          │                                          │
│          │──────────────────────────────────────────│
│          │ ChatInput                                │
└──────────┴──────────────────────────────────────────┘
```

Features:
- URL param: `?session=KEY` — auto-select session
- Left: SessionList component
- Right: ChatHeader + Messages + ChatInput
- When no session selected: empty state with "Select a session or start a new chat"
- When session selected: load history, show messages, enable input
- Real-time streaming from gateway events
- Auto-scroll to bottom on new messages

**Step 3: Verify chat works**

```bash
npm run dev
```

1. Open http://localhost:3000/chat
2. Sessions should load in sidebar
3. Click a Telegram session — history should load
4. Type a message — should stream response

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: chat page with session continuation, agent selection, and streaming"
```

---

## Phase 5: Dashboard Overview

### Task 13: Create dashboard overview page

**Files:**
- Modify: `app/page.tsx`

**Step 1: Create overview page**

RPC calls: `health`, `channels.status`, `agents.list`, `sessions.list`
Event subscription: `health`

Layout:
- Top row: Status cards (Health, Uptime, Version, Gateway ID)
- Middle row: Resource cards (Agents count, Active Sessions, Channels, Pending Approvals)
- Bottom: Recent sessions list + quick actions

Use shadcn Card components with Framer Motion fade-in animations.

**Step 2: Verify dashboard loads**

```bash
npm run dev
```

**Step 3: Commit**

```bash
git add app/page.tsx && git commit -m "feat: dashboard overview page with health and resource cards"
```

---

## Phase 6: Core Pages

### Task 14: Create agents page with CRUD and file management

**Files:**
- Create: `app/agents/page.tsx`
- Create: `app/agents/[id]/page.tsx`
- Create: `app/agents/new/page.tsx`

**Step 1: Create agents list page**

RPC: `agents.list`
- Card grid with emoji, name, default badge
- Click card → navigate to `/agents/[id]`
- "New Agent" button → `/agents/new`
- Delete with confirmation dialog

**Step 2: Create agent detail page**

RPC: `agents.list` (get single), `agents.update`, `agents.files.list`, `agents.files.get`, `agents.files.set`
- Edit form: name, emoji, theme
- File manager tab: list files, click to view/edit, save changes
- Delete button with confirmation

**Step 3: Create new agent page**

RPC: `agents.create`
- Form: name, emoji, theme/system prompt
- Validation: name required
- After create: navigate to agent detail

**Step 4: Commit**

```bash
git add app/agents/ && git commit -m "feat: agents pages with CRUD and file management"
```

---

### Task 15: Create sessions page with "Open Chat" action

**Files:**
- Create: `app/sessions/page.tsx`

**Step 1: Create sessions page**

RPC: `sessions.list`, `sessions.delete`, `sessions.reset`, `sessions.compact`, `sessions.patch`

Features:
- Table/list with columns: session key, agent, channel, model, tokens, last active
- Search and filter
- Row actions: Open Chat (→ /chat?session=KEY), Reset, Compact, Delete
- Session detail slide-over (click row) with patch options
- Confirmation dialogs for destructive actions

**Step 2: Commit**

```bash
git add app/sessions/ && git commit -m "feat: sessions page with chat navigation and management actions"
```

---

### Task 16: Create approvals page (NEW)

**Files:**
- Create: `app/approvals/page.tsx`

**Step 1: Create approvals page**

RPC: `exec.approvals.get` (list pending)
Events: `exec.approval.requested`, `exec.approval.resolved`

Features:
- Pending approval cards: command preview, agent, session, timestamp
- Approve / Reject buttons (call `exec.approval.resolve`)
- Real-time updates via events
- History section with resolved approvals
- Empty state when no pending approvals

**Step 2: Wire approval badge in sidebar**

When `exec.approval.requested` event fires, increment badge in sidebar.

**Step 3: Commit**

```bash
git add app/approvals/ && git commit -m "feat: exec approvals page with real-time notification"
```

---

### Task 17: Create usage page (NEW)

**Files:**
- Create: `app/usage/page.tsx`

**Step 1: Create usage page**

RPC: `usage.status`, `usage.cost`

Features:
- Token usage summary cards
- Recharts line chart: token usage over time
- Cost breakdown by model
- Top sessions by token consumption

**Step 2: Commit**

```bash
git add app/usage/ && git commit -m "feat: usage tracking page with charts"
```

---

## Phase 7: Remaining Pages

### Task 18: Create models page

**Files:** Create `app/models/page.tsx`

Port from existing. RPC: `models.list`. Card grid grouped by provider with context window and capability badges.

### Task 19: Create channels page

**Files:** Create `app/channels/page.tsx`

Port from existing. RPC: `channels.status`, `channels.logout`, `web.login.start`, `web.login.wait`. QR code login flow.

### Task 20: Create skills page

**Files:** Create `app/skills/page.tsx`

Port + enhance from existing. RPC: `skills.status`, `skills.install`, `skills.update`. Add install/update buttons.

### Task 21: Create cron page

**Files:** Create `app/cron/page.tsx`

Port from existing. RPC: `cron.list`, `cron.run`, `cron.remove`, `cron.update`, `cron.add`. Add job creation form.

### Task 22: Create nodes page

**Files:** Create `app/nodes/page.tsx`

Port + enhance. RPC: `node.list`, `device.pair.list`, `device.pair.approve/reject/remove`, `node.rename`. Add full pairing UI.

### Task 23: Create voice page

**Files:** Create `app/voice/page.tsx`

Port from existing. Three tabs: TTS, STT, Talk Mode. Add VoiceWake configuration.

### Task 24: Create config page

**Files:** Create `app/config/page.tsx`

Port + enhance. RPC: `config.get`, `config.set`, `config.apply`, `config.patch`. Grouped sections, search, masking.

### Task 25: Create logs page

**Files:** Create `app/logs/page.tsx`

Port + enhance. RPC: `logs.tail` with cursor-based pagination (no polling). Level filter, search, download, pause/resume.

**Each of tasks 18-25: implement, verify, commit individually.**

---

## Phase 8: Polish

### Task 26: Add Framer Motion page transitions

**Files:**
- Create: `components/layout/page-transition.tsx`
- Modify: all page files to wrap content

Subtle fade + slide-up animation on page change.

### Task 27: Add loading skeletons

**Files:**
- Create: `components/shared/loading.tsx`

Skeleton loaders for cards, lists, and chat messages using shadcn Skeleton.

### Task 28: Add empty states

**Files:**
- Create: `components/shared/empty-state.tsx`

Consistent empty state component with icon, title, description, and optional action button.

### Task 29: Final verification and cleanup

**Steps:**
1. Run `npm run build` — verify no build errors
2. Run `npm run lint` — fix any lint issues
3. Test all pages manually
4. Verify WebSocket reconnection works
5. Test chat session continuation (Telegram → Dashboard)
6. Verify approval notifications appear in sidebar

**Commit:**
```bash
git add -A && git commit -m "feat: FCDash v1.0 - complete rewrite with full OpenClaw API coverage"
```

---

## Execution Notes

- **Total tasks:** 29
- **Critical path:** Tasks 1-12 (scaffold → chat working)
- **Independent after Phase 3:** Tasks 13-25 can be parallelized
- **Each task:** 5-15 minutes for a skilled developer
- **Existing code reference:** Check `main` branch for existing implementations to port
- **Gateway API reference:** `&lt;openclaw-gateway&gt;/src/gateway/server-methods/`
- **Env config:** `.env.local` already has gateway URL and token — keep it
