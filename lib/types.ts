// OpenClaw Gateway Wire Protocol Types
// Ported from openclaw/src/gateway/protocol/schema/*

// ─── Frame Types ────────────────────────────────────────────────────────────

export type RequestFrame = {
  type: "req";
  id: string;
  method: string;
  params?: unknown;
};

export type ResponseFrame = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: GatewayError;
};

export type EventFrame = {
  type: "event";
  event: string;
  payload?: unknown;
  seq?: number;
  stateVersion?: StateVersion;
};

export type HelloOk = {
  type: "hello-ok";
  protocol: number;
  server: {
    version: string;
    commit?: string;
    host?: string;
    connId: string;
  };
  features: {
    methods: string[];
    events: string[];
  };
  snapshot: Snapshot;
  canvasHostUrl?: string;
  auth?: {
    deviceToken?: string;
    role?: string;
    scopes?: string[];
    issuedAtMs?: number;
  };
  policy?: {
    maxPayload?: number;
    maxBufferedBytes?: number;
    tickIntervalMs?: number;
  };
};

export type GatewayError = {
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
  retryAfterMs?: number;
};

// ─── Snapshot & Presence ────────────────────────────────────────────────────

export type StateVersion = {
  presence: number;
  health: number;
};

export type PresenceEntry = {
  host?: string;
  ip?: string;
  version?: string;
  platform?: string;
  deviceFamily?: string;
  modelIdentifier?: string;
  mode?: string;
  lastInputSeconds?: number;
  reason?: string;
  tags?: string[];
  text?: string;
  ts: number;
  deviceId?: string;
  roles?: string[];
  scopes?: string[];
  instanceId?: string;
};

export type Snapshot = {
  presence: PresenceEntry[];
  health: unknown;
  stateVersion: StateVersion;
  uptimeMs: number;
  configPath?: string;
  stateDir?: string;
  sessionDefaults?: {
    defaultAgentId: string;
    mainKey: string;
    mainSessionKey: string;
    scope?: string;
  };
  authMode?: "none" | "token" | "password" | "trusted-proxy";
};

// ─── Chat ───────────────────────────────────────────────────────────────────

export type ChatSendParams = {
  sessionKey: string;
  message: string;
  thinking?: string;
  deliver?: boolean;
  attachments?: Array<{
    type: string;
    name: string;
    data: string;
  }>;
  timeoutMs?: number;
  idempotencyKey: string;
};

export type ChatEvent = {
  runId: string;
  sessionKey: string;
  seq: number;
  state: "delta" | "final" | "aborted" | "error";
  message?: unknown;
  errorMessage?: string;
  usage?: unknown;
  stopReason?: string;
};

export type ChatAbortParams = {
  sessionKey: string;
  runId?: string;
};

export type ChatHistoryMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string | Array<{ type: string; text?: string; thinking?: string }>;
  timestamp?: number;
};

// ─── Agents ─────────────────────────────────────────────────────────────────

export type AgentIdentity = {
  name?: string;
  theme?: string;
  emoji?: string;
  avatar?: string;
  avatarUrl?: string;
};

export type AgentSummary = {
  id: string;
  name?: string;
  identity?: AgentIdentity;
};

export type AgentsListResult = {
  defaultId: string;
  mainKey: string;
  scope: "per-sender" | "global";
  agents: AgentSummary[];
};

export type AgentSendParams = {
  message: string;
  agentId?: string;
  to?: string;
  replyTo?: string;
  sessionId?: string;
  sessionKey?: string;
  thinking?: string;
  deliver?: boolean;
  attachments?: unknown[];
  channel?: string;
  replyChannel?: string;
  accountId?: string;
  replyAccountId?: string;
  threadId?: string;
  groupId?: string;
  groupChannel?: string;
  groupSpace?: string;
  timeout?: number;
  lane?: string;
  extraSystemPrompt?: string;
  idempotencyKey: string;
  label?: string;
  spawnedBy?: string;
};

// ─── Sessions ───────────────────────────────────────────────────────────────

export type SessionsListParams = {
  limit?: number;
  activeMinutes?: number;
  includeGlobal?: boolean;
  includeUnknown?: boolean;
  includeDerivedTitles?: boolean;
  includeLastMessage?: boolean;
  label?: string;
  spawnedBy?: string;
  agentId?: string;
  search?: string;
};

export type SessionSummary = {
  key: string;
  kind?: string;
  displayName?: string;
  channel?: string;
  chatType?: string;
  agentId?: string;
  label?: string;
  model?: string;
  updatedAt?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  origin?: {
    label?: string;
    provider?: string;
    surface?: string;
    chatType?: string;
  };
};

export type SessionsPatchParams = {
  key: string;
  label?: string | null;
  thinkingLevel?: string | null;
  verboseLevel?: string | null;
  reasoningLevel?: string | null;
  responseUsage?: "off" | "tokens" | "full" | "on" | null;
  elevatedLevel?: string | null;
  execHost?: string | null;
  execSecurity?: string | null;
  execAsk?: string | null;
  execNode?: string | null;
  model?: string | null;
  spawnedBy?: string | null;
  spawnDepth?: number | null;
  sendPolicy?: "allow" | "deny" | null;
  groupActivation?: "mention" | "always" | null;
};

// ─── Models ─────────────────────────────────────────────────────────────────

export type ModelChoice = {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
  input?: string[];
};

// ─── Nodes & Devices ────────────────────────────────────────────────────────

export type NodeInfo = {
  id: string;
  displayName?: string;
  platform?: string;
  version?: string;
  coreVersion?: string;
  uiVersion?: string;
  deviceFamily?: string;
  modelIdentifier?: string;
  caps?: string[];
  commands?: string[];
  status?: string;
  lastSeen?: number;
};

export type NodeInvokeParams = {
  nodeId: string;
  command: string;
  params?: unknown;
  timeoutMs?: number;
  idempotencyKey: string;
};

export type DeviceInfo = {
  deviceId: string;
  displayName?: string;
  role?: string;
  scopes?: string[];
  platform?: string;
  lastSeen?: number;
};

// ─── TTS / Voice ────────────────────────────────────────────────────────────

export type TTSProviderInfo = {
  id: string;
  name: string;
  configured?: boolean;
  models?: string[];
  voices?: string[];
};

export type TTSStatus = {
  enabled: boolean;
  provider?: string;
  voice?: string;
  providers?: TTSProviderInfo[];
};

// ─── Skills ─────────────────────────────────────────────────────────────────

export type SkillInfo = {
  name: string;
  skillKey: string;
  description?: string;
  emoji?: string;
  source?: string;
  bundled?: boolean;
  eligible?: boolean;
  disabled?: boolean;
  blockedByAllowlist?: boolean;
  filePath?: string;
  baseDir?: string;
  requirements?: {
    bins?: string[];
    anyBins?: string[];
    env?: string[];
    config?: string[];
    os?: string[];
  };
  missing?: {
    bins?: string[];
    anyBins?: string[];
    env?: string[];
    config?: string[];
    os?: string[];
  };
  install?: { id: string; kind: string; label: string; bins?: string[] }[];
};

export type SkillBin = {
  id: string;
  name: string;
  description?: string;
  skills: SkillInfo[];
};

// ─── Channels ───────────────────────────────────────────────────────────────

export type ChannelMeta = {
  id: string;
  label: string;
  detailLabel?: string;
  systemImage?: string;
};

export type ChannelDetail = {
  configured?: boolean;
  linked?: boolean;
  authAgeMs?: number;
  running?: boolean;
  connected?: boolean;
  self?: { e164?: string; jid?: string };
  lastError?: string | null;
  accountId?: string;
};

export type ChannelAccount = {
  accountId: string;
  displayName?: string;
  [key: string]: unknown;
};

export type ChannelsStatusResult = {
  channelOrder?: string[];
  channelLabels?: Record<string, string>;
  channelDetailLabels?: Record<string, string>;
  channelMeta?: ChannelMeta[];
  channels?: Record<string, ChannelDetail>;
  channelAccounts?: Record<string, ChannelAccount[]>;
  channelDefaultAccountId?: Record<string, string>;
};

// ─── Cron ───────────────────────────────────────────────────────────────────

export type CronJob = {
  id: string;
  name: string;
  expression: string;
  command: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  lastResult?: string;
};

export type CronRunResult = {
  id: string;
  cronId: string;
  startedAt: string;
  finishedAt?: string;
  status: "running" | "success" | "error";
  output?: string;
  error?: string;
};

// ─── Config ─────────────────────────────────────────────────────────────────

export type ConfigEntry = {
  key: string;
  value: unknown;
  type?: string;
  description?: string;
  section?: string;
};

// ─── Health ─────────────────────────────────────────────────────────────────

export type HealthStatus = {
  ok: boolean;
  ts?: number;
  durationMs?: number;
  channels?: Record<string, {
    configured?: boolean;
    linked?: boolean;
    authAgeMs?: number;
    running?: boolean;
    connected?: boolean;
  }>;
};

// ─── Exec Approvals ─────────────────────────────────────────────────────────

export type ExecApprovalSettings = {
  security: string;
  ask: string;
  askFallback: string;
  autoAllowSkills: boolean;
};

export type ExecApprovalEvent = {
  id: string;
  command?: string;
  agentId?: string;
  sessionKey?: string;
  timestamp?: number;
  request?: {
    command?: string;
    cwd?: string;
    host?: string;
    security?: string;
    ask?: string;
    agentId?: string;
    resolvedPath?: string;
    sessionKey?: string;
  };
  createdAtMs?: number;
  expiresAtMs?: number;
};

// ─── RPC Result Wrappers (gateway always returns objects, never bare arrays) ─

export type SessionsListResult = {
  ts: number;
  path: string;
  count: number;
  defaults: {
    modelProvider: string | null;
    model: string | null;
    contextTokens: number | null;
  };
  sessions: SessionSummary[];
};

export type ModelsListResult = {
  models: ModelChoice[];
};

export type CronListResult = {
  jobs: CronJob[];
};

export type NodesListResult = {
  ts: number;
  nodes: NodeInfo[];
};

export type DevicePairListResult = {
  pending: DeviceInfo[];
  paired: DeviceInfo[];
};

export type LogsTailResult = {
  file: string;
  cursor: number;
  size: number;
  lines: string[];
  truncated: boolean;
  reset: boolean;
};

export type ConfigGetResult = {
  path: string;
  exists: boolean;
  raw: string | null;
  config: unknown;
  valid: boolean;
  hash: string;
  issues: Array<{ path: string; message: string }>;
  warnings: Array<{ path: string; message: string }>;
};

// ─── Gateway Connection State ───────────────────────────────────────────────

export type GatewayConnectionState =
  | "disconnected"
  | "connecting"
  | "authenticating"
  | "connected"
  | "error";

// ─── RPC Method Map (for typed calls) ───────────────────────────────────────

export type RPCMethodMap = {
  // Health & Status
  "health": [void, HealthStatus];
  "status": [void, unknown];
  "usage.status": [void, unknown];
  "usage.cost": [{ days?: number } | void, unknown];
  "sessions.usage": [{ limit?: number } | void, unknown];

  // Chat
  "chat.send": [ChatSendParams, { runId: string }];
  "chat.history": [
    { sessionKey: string; limit?: number },
    { sessionKey: string; sessionId: string; messages: ChatHistoryMessage[]; thinkingLevel?: string; verboseLevel?: string }
  ];
  "chat.abort": [ChatAbortParams, void];

  // Agents
  "agents.list": [void, AgentsListResult];
  "agents.create": [Partial<AgentSummary>, AgentSummary];
  "agents.update": [Partial<AgentSummary> & { id: string }, AgentSummary];
  "agents.delete": [{ id: string }, void];

  // Agent messaging
  "agent": [AgentSendParams, { runId: string }];

  // Agent files
  "agents.files.list": [{ agentId: string }, { files: string[] }];
  "agents.files.get": [{ agentId: string; file: string }, { content: string }];
  "agents.files.set": [{ agentId: string; file: string; content: string }, void];

  // Sessions
  "sessions.list": [SessionsListParams | void, SessionsListResult];
  "sessions.preview": [{ key: string }, unknown];
  "sessions.patch": [SessionsPatchParams, void];
  "sessions.reset": [{ key: string }, void];
  "sessions.delete": [{ key: string }, void];
  "sessions.compact": [{ key: string }, void];
  "sessions.resolve": [{ key: string }, { sessionKey: string; agentId: string }];

  // Models
  "models.list": [void, ModelsListResult];

  // TTS
  "tts.status": [void, TTSStatus];
  "tts.providers": [void, { providers: TTSProviderInfo[] }];
  "tts.enable": [void, void];
  "tts.disable": [void, void];
  "tts.setProvider": [{ provider: string; voice?: string }, void];
  "tts.convert": [{ text: string }, { audio: string }];

  // Nodes
  "node.list": [void, NodesListResult];
  "node.describe": [{ nodeId: string }, NodeInfo];
  "node.rename": [{ nodeId: string; displayName: string }, void];
  "node.invoke": [NodeInvokeParams, unknown];

  // Node pairing
  "node.pair.request": [{ displayName?: string }, { nodeId: string }];
  "node.pair.list": [void, { pending: Array<{ nodeId: string; displayName?: string; status: string }>; paired: Array<{ nodeId: string; displayName?: string; status: string }> }];
  "node.pair.approve": [{ nodeId: string }, void];
  "node.pair.reject": [{ nodeId: string }, void];

  // Device pairing
  "device.pair.list": [void, DevicePairListResult];
  "device.pair.approve": [{ deviceId: string }, void];
  "device.pair.reject": [{ deviceId: string }, void];
  "device.pair.remove": [{ deviceId: string }, void];

  // Device tokens
  "device.token.rotate": [{ deviceId: string }, { token: string }];
  "device.token.revoke": [{ deviceId: string }, void];

  // Skills
  "skills.status": [void, { skills: SkillInfo[]; workspaceDir?: string; managedSkillsDir?: string }];
  "skills.bins": [void, { bins: string[] }];
  "skills.install": [{ id: string }, void];
  "skills.update": [{ id: string }, void];

  // Channels
  "channels.status": [void, ChannelsStatusResult];
  "channels.logout": [{ id: string }, void];

  // Web Login (WhatsApp QR code flow)
  "web.login.start": [{ id?: string } | void, { qrDataUrl: string; message?: string }];
  "web.login.wait": [{ timeoutMs?: number } | void, { connected: boolean; message?: string }];

  // Cron
  "cron.list": [void, CronListResult];
  "cron.status": [void, unknown];
  "cron.add": [Omit<CronJob, "id" | "lastRun" | "nextRun" | "lastResult">, CronJob];
  "cron.update": [Partial<CronJob> & { id: string }, CronJob];
  "cron.remove": [{ id: string }, void];
  "cron.run": [{ id: string }, CronRunResult];
  "cron.runs": [{ id: string; limit?: number }, { entries: CronRunResult[] }];

  // Config
  "config.get": [{ key?: string } | void, ConfigGetResult];
  "config.set": [{ raw: string; baseHash: string }, void];
  "config.schema": [void, { schema: unknown; uiHints?: unknown; version?: string }];
  "config.apply": [void, void];
  "config.patch": [{ patch: Record<string, unknown> }, void];

  // Exec approvals
  "exec.approval.resolve": [{ id: string; approved: boolean }, void];
  "exec.approvals.get": [void, ExecApprovalSettings];
  "exec.approvals.set": [Partial<ExecApprovalSettings>, void];

  // Logs
  "logs.tail": [{ limit?: number; cursor?: number; maxBytes?: number } | void, LogsTailResult];

  // Talk mode
  "talk.config": [void, unknown];
  "talk.mode": [{ enabled: boolean }, void];

  // Voicewake
  "voicewake.get": [void, { enabled: boolean; keyword?: string }];
  "voicewake.set": [{ enabled: boolean; keyword?: string }, void];

  // Update
  "update.run": [void, { version: string; updated: boolean }];
};

// Helper to extract params and result types
export type RPCParams<M extends keyof RPCMethodMap> = RPCMethodMap[M][0];
export type RPCResult<M extends keyof RPCMethodMap> = RPCMethodMap[M][1];

// ─── Event Map ──────────────────────────────────────────────────────────────

export type GatewayEventMap = {
  "connect.challenge": { nonce: string };
  "agent": unknown;
  "chat": ChatEvent;
  "presence": PresenceEntry[];
  "tick": { ts: number };
  "talk.mode": { enabled: boolean };
  "shutdown": { reason?: string };
  "health": unknown;
  "heartbeat": unknown;
  "cron": { cronId: string; event: string };
  "node.pair.requested": { nodeId: string; displayName?: string };
  "node.pair.resolved": { nodeId: string; approved: boolean };
  "node.invoke.request": unknown;
  "device.pair.requested": { deviceId: string };
  "device.pair.resolved": { deviceId: string; approved: boolean };
  "voicewake.changed": { enabled: boolean; keyword?: string };
  "exec.approval.requested": ExecApprovalEvent;
  "exec.approval.resolved": { id: string; approved: boolean };
};

export type GatewayEventName = keyof GatewayEventMap;
