# Launch Posts

## Hacker News — Show HN

**Title:** Show HN: Open-source React dashboard for OpenClaw – visual UI for every CLI command

**Text:**

Hey HN,

I built a web dashboard for OpenClaw, the self-hosted AI gateway that was recently acquired by OpenAI.

OpenClaw has 35+ CLI commands and 80+ gateway RPC methods, but the only UI was a basic Lit web component. I wanted something visual — so I built a full Next.js dashboard that connects directly to the gateway over WebSocket.

What it does:

- Streaming chat with any configured LLM (token-by-token via WebSocket)
- WhatsApp QR code login — scan right from the browser
- Agent CRUD, session browser, model catalog
- TTS voice testing with audio playback
- Skills marketplace, cron scheduler, config editor, live logs
- Speech-to-text everywhere — floating mic button (Cmd+Shift+M) injects transcription into any input

Tech: Next.js 15, React 19, TypeScript, Tailwind v4. Zero external UI libraries. No database — it's a pure WebSocket client to the OpenClaw gateway protocol v3.

Repo: https://github.com/actionagentai/openclaw-dashboard

Would love feedback on the gateway client implementation (lib/gateway-client.ts) — it handles challenge-nonce auth, auto-reconnect with exponential backoff, and typed RPC for all 80+ methods.

---

## Twitter/X Thread

**Tweet 1 (hook):**

I built an open-source React dashboard for OpenClaw — the AI gateway OpenAI just acquired.

Every CLI command is now a visual UI page. Streaming chat, WhatsApp QR login, voice-to-text everywhere.

Here's the repo: https://github.com/actionagentai/openclaw-dashboard

🧵 Thread:

**Tweet 2 (the problem):**

OpenClaw has 35+ CLI commands, 80+ WebSocket RPC methods, 20+ messaging channels, and a full voice pipeline.

But the only UI was a minimal Lit web component with ~580 state fields in a single file.

I rebuilt the entire frontend from scratch in Next.js.

**Tweet 3 (what it does):**

12 pages covering everything:

→ Streaming chat (token-by-token over WebSocket)
→ WhatsApp QR code login from the browser
→ Agent management (create, edit, delete)
→ Model catalog with provider filtering
→ TTS voice testing with audio playback
→ Live config editor, cron scheduler, log viewer

**Tweet 4 (STT everywhere):**

My favorite feature: speech-to-text everywhere.

A floating mic button (Cmd+Shift+M) uses the browser's Web Speech API to inject voice transcription into any focused input field.

Zero server dependency. Works offline.

**Tweet 5 (tech):**

Tech stack:
- Next.js 15 + React 19
- TypeScript strict mode
- Tailwind v4
- Zero UI component libraries
- Pure WebSocket client (no database)
- Typed RPC for all 80+ gateway methods

The gateway client handles challenge-nonce auth, auto-reconnect, and sequence gap detection.

**Tweet 6 (CTA):**

The repo is MIT licensed, same as OpenClaw.

If you run OpenClaw, try it:

git clone https://github.com/actionagentai/openclaw-dashboard
npm install && npm run dev

Star it if it's useful. PRs welcome.

---

## Reddit — r/selfhosted

**Title:** I built a web dashboard for OpenClaw so you don't need the terminal anymore

**Text:**

OpenClaw is a self-hosted AI assistant gateway with 35+ commands, 50+ skills, and 20+ messaging channel integrations (WhatsApp, Telegram, Discord, etc.).

I built a visual dashboard in Next.js that connects to the OpenClaw gateway over WebSocket. Every CLI command now has a UI page — chat with streaming, WhatsApp QR login, agent management, model browser, voice controls, and more.

No database needed. It's a pure WebSocket client. Just point it at your running gateway and go.

Repo: https://github.com/actionagentai/openclaw-dashboard

Stack: Next.js 15, React 19, TypeScript, Tailwind v4. Zero external UI libraries.

---

## Reddit — r/opensource

**Title:** Community-built React dashboard for OpenClaw (the AI gateway OpenAI just acquired)

**Text:**

With OpenClaw's recent acquisition by OpenAI, the project is staying open source under a foundation. I wanted to contribute something meaningful to the community — so I built a full web dashboard.

It covers all 12 major CLI command groups as visual pages: streaming chat, WhatsApp QR code login, agent CRUD, session browser, model catalog, TTS/STT controls, skills marketplace, and more.

The whole thing is a pure WebSocket client — no database, no backend beyond Next.js. Just connects to the OpenClaw gateway protocol directly.

MIT licensed: https://github.com/actionagentai/openclaw-dashboard

Feedback and PRs welcome.
