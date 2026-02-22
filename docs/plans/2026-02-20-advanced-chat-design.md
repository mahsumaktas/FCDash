# Advanced Chat Design — FCDash

**Date:** 2026-02-20
**Goal:** Replace basic chat with a production-grade, Telegram-like messaging interface for OpenClaw gateway sessions.

---

## Requirements Summary

- Telegram-like layout: left session sidebar + right chat area
- Details panel: slides in from right on demand (doesn't disrupt chat view)
- Details panel content: session info, token/cost, tool call logs, raw JSON, per-message model/provider
- Attachment support: images + general files (base64 encoding)
- Full markdown rendering via react-markdown + remark-gfm
- Client-side message search (Ctrl+F)
- Per-message model/provider chip (small, like OpenClaw web UI)

---

## Architecture

### Approach: Evolutionary (A)
Extend existing component structure. No full rewrite. Add new components on top of working foundation.

### Data Layer Changes

**`stores/chat.ts` — extend `ChatMessage`:**
```ts
interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: number
  state?: "delta" | "final" | "aborted" | "error"
  runId?: string
  // NEW:
  attachments?: Attachment[]
  metadata?: MessageMetadata
}

interface Attachment {
  id: string
  name: string
  mimeType: string
  size: number
  base64: string          // full data URL for small files, or blob URL
  previewUrl?: string     // thumbnail for images
}

interface MessageMetadata {
  model?: string
  provider?: string
  inputTokens?: number
  outputTokens?: number
  cost?: number
  toolCalls?: ToolCall[]
  rawEvent?: unknown
}

interface ToolCall {
  id: string
  name: string
  input?: unknown
  output?: unknown
  startedAt?: number
  endedAt?: number
}
```

**`lib/types.ts` — extend `ChatSendParams`:**
```ts
attachments?: Array<{
  type: string    // "image/jpeg", "application/pdf", etc.
  name: string
  data: string    // base64 without prefix
}>
```

---

## Component Plan

### Modified Components

| Component | Changes |
|-----------|---------|
| `components/chat/message-bubble.tsx` | react-markdown renderer, attachment thumbnails, model/provider chip |
| `components/chat/chat-input.tsx` | File picker button, drag-drop zone, paste-image, attachment preview strip |
| `components/chat/chat-header.tsx` | Details toggle button, search toggle button |
| `hooks/use-chat.ts` | Parse tool calls from history, extract metadata from chat events |
| `stores/chat.ts` | Add Attachment, MessageMetadata types, update store interface |

### New Components

| Component | Purpose |
|-----------|---------|
| `components/chat/details-panel.tsx` | Slide-over panel with 4 tabs: Session / Tokens / Tools / Raw |
| `components/chat/attachment-preview.tsx` | Thumbnail grid in message bubble, lightbox for images |
| `components/chat/message-search.tsx` | Ctrl+F overlay, highlight matches, prev/next navigation |
| `components/chat/tool-call-log.tsx` | Accordion list of tool calls with input/output |

---

## Details Panel Design

```
┌─────────────────────────────────┐
│ Session  Tokens  Tools  Raw  [X]│
├─────────────────────────────────┤
│                                 │
│ [Session Tab]                   │
│ Agent:    my-agent              │
│ Model:    gpt-4o                │
│ Channel:  telegram              │
│ Key:      telegram:123456       │
│ Created:  2h ago                │
│ Updated:  3min ago              │
│                                 │
│ [Tokens Tab]                    │
│ Input tokens:   1,234           │
│ Output tokens:  456             │
│ Total:          1,690           │
│ Est. cost:      $0.012          │
│                                 │
│ [Tools Tab]                     │
│ ▼ web_search  10:32             │
│   query: "istanbul weather"     │
│   result: "21°C, sunny..."      │
│ ► read_file   10:33             │
│                                 │
│ [Raw Tab]                       │
│ {                               │
│   "runId": "abc123",            │
│   "state": "final",             │
│   "usage": { "input": 1234 }    │
│ }                               │
└─────────────────────────────────┘
```

---

## Message Bubble — Per-Message Metadata

Each assistant message bubble shows at bottom-right:
```
╭─────────────────────────────────────────╮
│ AI response text here...                │
│                                         │
│               gpt-4o · openai  10:32 ✓✓│
╰─────────────────────────────────────────╯
```

Click on the model/provider chip → opens Details panel and jumps to Raw tab for that message.

---

## Attachment Flow

```
1. User clicks 📎 or 🖼 button (or drags file, or pastes image)
2. File converted to base64 in browser
3. Preview strip shown above input:
   ┌──────────────────────────┐
   │ [×] image.jpg  [×] doc.pdf│
   │  [thumbnail]   📄         │
   └──────────────────────────┘
4. User sends → chat.send({ message, attachments: [{type, name, data}] })
5. Message bubble shows thumbnails inline
6. Click image → lightbox
7. Click file → download
```

---

## Search (Ctrl+F)

- Client-side only (first phase)
- Searches loaded messages in current session
- Highlights all matches
- Prev/Next navigation
- Escape to close

---

## Dependencies to Add

```
react-markdown
remark-gfm
rehype-highlight  (syntax highlighting in code blocks)
highlight.js      (or shikiji)
```

---

## Implementation Phases

1. **Phase 1** — react-markdown + per-message model chip
2. **Phase 2** — Details panel (4 tabs)
3. **Phase 3** — Attachment support (upload + display)
4. **Phase 4** — Message search (Ctrl+F)
