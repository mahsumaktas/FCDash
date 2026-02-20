# FCDash (Full Control Dashboard) — Complete Redesign

**Date:** 2026-02-20
**Status:** Approved
**Scope:** Rewrite from scratch

---

## 1. Purpose

FCDash is a full-control dashboard for OpenClaw AI agent platform. It replaces the existing openclaw-dashboard with a modern, Apple-quality interface that covers 100% of the OpenClaw gateway API (91 RPC methods, 17 events).

**Key goals:**
- Continue Telegram/WhatsApp conversations from the dashboard
- Select which agent to chat with
- Full exec approval management (security)
- Token/cost usage tracking
- Modern minimal UI with shadcn/ui + Framer Motion
- Stability and security first

---

## 2. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.x |
| UI Runtime | React | 19.x |
| Language | TypeScript (strict) | 5.7+ |
| Components | shadcn/ui + Radix UI | latest |
| Styling | Tailwind CSS | v4 |
| Animation | Framer Motion | latest |
| State | Zustand | latest |
| Icons | Lucide React | latest |
| Command Palette | cmdk | latest |
| Charts | Recharts | latest |
| Notifications | Sonner | latest |
| Realtime | WebSocket (custom gateway-client) | — |

---

## 3. Architecture

```
fcdash/
├── app/
│   ├── layout.tsx              # Root layout, providers, sidebar
│   ├── page.tsx                # Dashboard overview
│   ├── chat/page.tsx           # Sidebar sessions + chat (primary feature)
│   ├── agents/
│   │   ├── page.tsx            # Agent list with cards
│   │   ├── new/page.tsx        # Create agent
│   │   └── [id]/page.tsx       # Edit agent + files
│   ├── sessions/page.tsx       # Session management + "open chat" links
│   ├── approvals/page.tsx      # Exec approval queue (NEW)
│   ├── models/page.tsx         # Model browser
│   ├── channels/page.tsx       # Channel linking (QR, etc.)
│   ├── skills/page.tsx         # Skill registry + install
│   ├── cron/page.tsx           # Scheduled jobs
│   ├── nodes/page.tsx          # Nodes + device pairing
│   ├── voice/page.tsx          # TTS/STT/Talk mode
│   ├── config/page.tsx         # Configuration editor
│   ├── logs/page.tsx           # Live log viewer
│   └── usage/page.tsx          # Token/cost tracking (NEW)
├── components/
│   ├── ui/                     # shadcn/ui primitives (button, card, dialog, etc.)
│   ├── layout/
│   │   ├── app-sidebar.tsx     # Main navigation sidebar
│   │   ├── app-header.tsx      # Top header with breadcrumb + Cmd+K
│   │   └── command-palette.tsx # Cmd+K global search/navigation
│   ├── chat/
│   │   ├── session-list.tsx    # Left sidebar session list
│   │   ├── message-bubble.tsx  # Chat message with role/content/timestamp
│   │   ├── chat-input.tsx      # Input with send, mic, abort
│   │   ├── agent-selector.tsx  # Agent picker for new chats
│   │   └── chat-header.tsx     # Active session + agent info
│   └── shared/
│       ├── status-badge.tsx    # Online/offline/error badges
│       ├── time-ago.tsx        # Relative time display
│       ├── empty-state.tsx     # Empty state illustrations
│       └── loading.tsx         # Skeleton loaders
├── stores/
│   ├── gateway.ts              # Zustand: connection state, hello, snapshot
│   ├── chat.ts                 # Zustand: active session, messages, streaming
│   └── notifications.ts       # Zustand: approval notifications, alerts
├── lib/
│   ├── gateway-client.ts       # WebSocket client (ported + improved)
│   ├── types.ts                # ALL 91 RPC methods typed
│   ├── utils.ts                # cn(), formatters, helpers
│   └── constants.ts            # Theme colors, config keys
├── hooks/
│   ├── use-gateway.ts          # Connect gateway-client to Zustand store
│   ├── use-rpc.ts              # Typed RPC wrapper with loading/error
│   └── use-event.ts            # Typed event subscription hook
└── public/
    └── ...                     # Static assets
```

---

## 4. Key Features (by page)

### 4.1 Dashboard Overview (`/`)
- System health card with uptime
- Active agents count with emoji avatars
- Connected channels status
- Recent sessions activity
- Pending approvals badge (links to /approvals)
- Token usage mini-chart (last 24h)
- Quick actions: New Chat, View Logs

### 4.2 Chat (`/chat`) — PRIMARY FEATURE
- **Left sidebar:** All sessions grouped by channel (Telegram, WhatsApp, Web)
  - Search/filter sessions
  - Each session shows: agent emoji, display name, last message preview, time
  - Active session highlighted
  - "New Chat" button at top
- **Main area:** Chat messages with streaming
  - Load `chat.history` when session selected
  - Real-time `chat` event streaming (delta → final)
  - User and assistant message bubbles
  - Thinking blocks collapsible
  - Tool call results inline
  - Abort button during streaming
- **Header:** Agent info (emoji + name), session key, model badge
- **New Chat flow:**
  1. Click "New Chat"
  2. Agent selector modal (agents.list)
  3. Optional: select existing session or create new
  4. Start chatting
- **URL routing:** `/chat?session=telegram:123` for deep links

### 4.3 Agents (`/agents`)
- Card grid with agent emoji, name, theme preview
- Default agent star badge
- Click card → detail view with:
  - Identity editing (name, emoji, avatar)
  - System prompt/theme editor
  - File manager (agents.files.list/get/set)
- Create new agent with validation

### 4.4 Sessions (`/sessions`)
- Sortable/filterable table
- Columns: session key, agent, channel, model, tokens, last active
- Row actions: Open Chat (→ /chat?session=KEY), Reset, Compact, Delete, Patch
- Session detail slide-over with patch options (model, label, etc.)

### 4.5 Approvals (`/approvals`) — NEW
- Pending exec approval requests as cards
- Each card: command, agent, session, timestamp
- Approve / Reject buttons
- Real-time via `exec.approval.requested` event
- History of resolved approvals
- Notification badge in sidebar when pending

### 4.6 Usage (`/usage`) — NEW
- Token usage over time (Recharts line chart)
- Cost breakdown by model/agent
- Top sessions by token consumption
- Daily/weekly/monthly aggregation

### 4.7 Models (`/models`)
- Model cards grouped by provider
- Context window, reasoning capability, input types
- Visual provider badges with colors

### 4.8 Channels (`/channels`)
- Channel status cards with linked/configured indicators
- QR code login flow (WhatsApp)
- Logout/reconnect actions
- Auth age display

### 4.9 Skills (`/skills`)
- Skill cards with status (ready/missing/disabled)
- Install/update actions
- Search and filter by status
- Missing requirements display

### 4.10 Cron (`/cron`)
- Job list with enable/disable toggle
- Run Now button
- Add/edit job form
- Run history with output
- Real-time cron events

### 4.11 Nodes (`/nodes`)
- Node cards with platform, version, capabilities
- Device pairing: approve/reject/remove
- Node rename inline
- Node invoke capability

### 4.12 Voice (`/voice`)
- TTS: provider selection, test synthesis, play audio
- STT: browser Speech API, live transcript
- Talk Mode: enable/disable toggle
- Voice Wake: keyword configuration

### 4.13 Config (`/config`)
- Grouped config sections
- Search functionality
- Inline JSON editor per key
- Apply/patch support
- Sensitive value masking

### 4.14 Logs (`/logs`)
- Terminal-style log viewer (dark background)
- Level filtering (error/warn/info/debug)
- Text search
- Pause/resume auto-scroll
- Download as text file
- Cursor-based pagination (no polling — use cursor from last response)

---

## 5. Global Features

### 5.1 Command Palette (Cmd+K)
- Search agents, sessions, pages
- Quick actions: "New chat with Hachi", "Open logs", "View approvals"
- Keyboard-first navigation

### 5.2 Sidebar Navigation
- Collapsible sidebar with icons + labels
- Connection status indicator (animated)
- Approval notification badge
- FCDash branding

### 5.3 Notifications
- Sonner toast for: approval requests, errors, success confirmations
- Sidebar badge for pending approvals
- Sound notification option for approvals

### 5.4 Theme
- Dark mode default (Apple-dark aesthetic)
- Light mode via system preference
- CSS variables for all colors
- Consistent border radius (0.5rem)
- Subtle backdrop-blur on overlays

---

## 6. Security

- Gateway token authentication (env var)
- No sensitive data stored in browser (token in memory only)
- Config editor masks API keys
- Input sanitization on all user inputs
- XSS prevention: no dangerouslySetInnerHTML
- CSRF: WebSocket token-based auth
- Audit: all destructive actions require confirmation dialog

---

## 7. Gateway Client Improvements

From existing `gateway-client.ts`, enhance:
- Add cursor tracking for `logs.tail` (no more polling)
- Auto-reconnect with exponential backoff (keep existing)
- Connection health heartbeat monitoring
- Event buffer for missed events during reconnection
- Typed event subscriptions (remove `as never` casts)

---

## 8. Type Coverage

Update `types.ts` to cover ALL 91 gateway methods:
- Add missing: `agent`, `agents.files.*`, `exec.approval.*`, `wizard.*`, `sessions.resolve`, `config.apply`, `config.patch`, `device.token.*`, `node.pair.*`, `update.run`, `browser.request`, `system-presence`, `system-event`
- Fix `chat.history` return type (object, not array)
- Add proper event payload types for all 17 events

---

## 9. Project Setup

- Project directory: `/Users/mahsum/openclaw-dashboard/` (overwrite existing)
- Package name: `fcdash`
- Reuse existing `.env.local` (gateway URL + token)
- Reuse existing `gateway-client.ts` as base (port + improve)
- Reuse existing `types.ts` as base (extend to 91 methods)
