"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { AnimatePresence } from "framer-motion";
import { useChat, useDisplayMessages } from "@/hooks/use-chat";
import { SessionList } from "@/components/chat/session-list";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatHeader } from "@/components/chat/chat-header";
import { MessageSquare, WifiOff, ArrowDown, RefreshCw, Bot } from "lucide-react";
import type { ChatMessage, SessionUsage } from "@/stores/chat";
import { useNotificationStore } from "@/stores/notifications";
import { useGatewaySSEStore } from "@/stores/gateway-sse";
import { api } from "@/lib/api-client";
import { getContextWindow, getContextPercent } from "@/lib/model-utils";

// Lazy-loaded components (ender kullanılan modal/conditional komponentler)
const AgentSelector = dynamic(() => import("@/components/chat/agent-selector").then((m) => ({ default: m.AgentSelector })));
const DetailsPanel = dynamic(() => import("@/components/chat/details-panel").then((m) => ({ default: m.DetailsPanel })));
const MessageSearch = dynamic(() => import("@/components/chat/message-search").then((m) => ({ default: m.MessageSearch })));
const ExecApprovalCard = dynamic(() => import("@/components/chat/exec-approval-card").then((m) => ({ default: m.ExecApprovalCard })));

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function SessionFooter({
  sessionModel,
  sessionUsage,
  messageCount,
}: {
  sessionModel: string | null;
  sessionUsage: SessionUsage | null;
  messageCount: number;
}) {
  const totalTokens = sessionUsage?.totalTokens ?? 0;
  const totalCost = sessionUsage?.totalCost ?? 0;
  const model = sessionUsage?.model ?? sessionModel;

  // Always render — show placeholder when no data yet
  const contextWindow = getContextWindow(model);
  const pct = totalTokens > 0 ? getContextPercent(model, totalTokens) : 0;

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 border-t border-border/50 bg-muted/20 text-[10px] font-mono text-muted-foreground/60 select-none shrink-0">
      {model && (
        <span className="font-medium text-muted-foreground/70 truncate max-w-[140px]">{model}</span>
      )}
      <span className="text-muted-foreground/50">tokens</span>
      <span>{fmtTokens(totalTokens)}/{fmtTokens(contextWindow)}</span>
      {totalTokens > 0 && (
        <span className="text-muted-foreground/40">({pct}%)</span>
      )}
      <div className="w-20 h-1.5 rounded-full bg-muted/40 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary/60 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      {totalCost > 0 && (
        <span>${totalCost < 0.01 ? totalCost.toFixed(4) : totalCost.toFixed(2)}</span>
      )}
      <span className="ml-auto">{messageCount > 0 ? `${messageCount}msg` : "—"}</span>
    </div>
  );
}

function ChatPageInner() {
  const searchParams = useSearchParams();
  const initialSession = searchParams?.get("session") ?? null;

  const {
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
    switchSession,
    retryMessage,
  } = useChat();

  // Apply message filtering & deduplication
  const displayMessages = useDisplayMessages(messages);

  const [showAgentSelector, setShowAgentSelector] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [focusedMessage, setFocusedMessage] = useState<ChatMessage | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Refs-only scroll tracking (no state updates in scroll handler)
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const isNearBottomRef = useRef(true);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const prevMsgCountRef = useRef(0);
  const unreadCountRef = useRef(0);

  // These are state for UI rendering only (updated outside scroll handler)
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (initialSession && !activeSessionKey) {
      switchSession(initialSession);
    }
  }, [initialSession, activeSessionKey, switchSession]);

  // Auto-scroll: use refs pattern (ClawSuite stickToBottom)
  useEffect(() => {
    if (stickToBottomRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    } else if (displayMessages.length > prevMsgCountRef.current) {
      const newCount = displayMessages.length - prevMsgCountRef.current;
      unreadCountRef.current += newCount;
      setUnreadCount(unreadCountRef.current);
    }
    prevMsgCountRef.current = displayMessages.length;
  }, [displayMessages]);

  // Scroll handler: refs only, no state updates (200px threshold)
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const distFromBottom = scrollHeight - scrollTop - clientHeight;
    const nearBottom = distFromBottom < 200;

    isNearBottomRef.current = nearBottom;
    stickToBottomRef.current = distFromBottom < 50;

    // Only update state when crossing threshold
    setShowScrollBtn(!nearBottom);
    if (nearBottom) {
      unreadCountRef.current = 0;
      setUnreadCount(0);
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      stickToBottomRef.current = true;
      isNearBottomRef.current = true;
      setShowScrollBtn(false);
      unreadCountRef.current = 0;
      setUnreadCount(0);
    }
  }, []);

  const handleNewChat = useCallback(
    (agentId: string) => {
      const key = `agent:${agentId}:webchat:fcdash:${Date.now()}`;
      switchSession(key);
      setShowAgentSelector(false);
    },
    [switchSession]
  );

  const handleShowDetails = useCallback((msg: ChatMessage) => {
    setFocusedMessage(msg);
    setDetailsOpen(true);
  }, []);

  const handleMatchFocus = useCallback((messageId: string) => {
    setHighlightedId(messageId);
    const el = messageRefs.current.get(messageId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  const handleRetry = useCallback((msg: ChatMessage) => {
    retryMessage(msg);
  }, [retryMessage]);

  const pendingApprovals = useNotificationStore((s) => s.pendingApprovals);
  const connectionState = useGatewaySSEStore((s) => s.gatewayState);
  const gatewayReconnect = useCallback(() => {
    // Hitting the health endpoint triggers server-side gateway reconnection
    api.health().catch(() => {});
  }, []);

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

  useEffect(() => {
    function handler() { setShowAgentSelector(true); }
    window.addEventListener("fcdash:new-session", handler);
    return () => window.removeEventListener("fcdash:new-session", handler);
  }, []);

  return (
    <div className="flex h-full">
      <SessionList
        activeKey={activeSessionKey}
        onSelect={(key) => {
          switchSession(key);
          setFocusedMessage(null);
          setDetailsOpen(false);
          setSearchOpen(false);
          unreadCountRef.current = 0;
          setUnreadCount(0);
        }}
        onNewChat={() => setShowAgentSelector(true)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Gateway reconnect banner */}
        {!isConnected && (
          <div className="flex items-center gap-2 px-4 py-2.5 text-xs bg-amber-500/10 border-b border-amber-500/20">
            <WifiOff className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="text-amber-600 dark:text-amber-400 flex-1">
              {connectionState === "connecting" || connectionState === "authenticating"
                ? "Connecting to gateway..."
                : "Gateway unreachable. Chat features are unavailable."
              }
            </span>
            {connectionState !== "connecting" && connectionState !== "authenticating" && (
              <button
                onClick={gatewayReconnect}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/30 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            )}
          </div>
        )}

        {/* Exec approval cards */}
        {pendingApprovals.length > 0 && activeSessionKey && (
          <div className="px-4 py-2 border-b border-border space-y-2 bg-card/50">
            {pendingApprovals
              .filter((a) => !a.sessionKey || a.sessionKey === activeSessionKey)
              .map((a) => (
                <ExecApprovalCard
                  key={a.id}
                  approvalId={a.id}
                  command={a.command}
                  agentId={a.agentId}
                  sessionKey={a.sessionKey}
                />
              ))
            }
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
              messages={displayMessages}
            />

            <MessageSearch
              open={searchOpen}
              messages={displayMessages}
              onClose={() => setSearchOpen(false)}
              onMatchFocus={handleMatchFocus}
            />

            <div className="relative flex-1 overflow-hidden">
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="h-full overflow-y-auto px-4 py-4 space-y-4"
              >
                {displayMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-sm">No messages yet. Start the conversation.</p>
                  </div>
                ) : (
                  <>
                    {displayMessages.map((msg) => (
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
                          onRetry={handleRetry}
                          sessionModel={sessionModel ?? undefined}
                          sessionProvider={sessionProvider ?? undefined}
                          sessionUsage={sessionUsage}
                          streamingState={currentStreamingState}
                        />
                      </div>
                    ))}
                    {/* Pending indicator: streaming started but no assistant delta yet */}
                    {isStreaming && !displayMessages.some((m) => m.role === "assistant" && m.state === "delta") && (
                      <div className="flex justify-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Bot className="w-3 h-3 text-primary" />
                        </div>
                        <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-2.5">
                          <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Scroll-to-bottom button */}
              <AnimatePresence>
                {showScrollBtn && (
                  <button
                    onClick={scrollToBottom}
                    className="absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-2 rounded-full bg-card border border-border shadow-lg hover:bg-accent transition-colors text-sm"
                  >
                    <ArrowDown className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-[10px] font-medium min-w-[18px] text-center">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                )}
              </AnimatePresence>
            </div>

            {error && (
              <div className="px-4 py-2 text-xs text-destructive bg-destructive/10 border-t border-destructive/20">
                {error}
              </div>
            )}

            <SessionFooter
              sessionModel={sessionModel}
              sessionUsage={sessionUsage}
              messageCount={displayMessages.filter((m) => m.role === "assistant").length}
            />

            <ChatInput
              onSend={sendMessage}
              onAbort={abort}
              isStreaming={isStreaming}
              disabled={!activeSessionKey || !isConnected}
              sessionKey={activeSessionKey ?? undefined}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MessageSquare className="w-16 h-16 mb-4 opacity-10" />
            <h2 className="text-lg font-medium mb-1">Select a session</h2>
            <p className="text-sm">Choose a session from the sidebar or start a new chat</p>
            <button
              onClick={() => {
                const sidebar = document.getElementById("session-sidebar");
                sidebar?.classList.toggle("max-md:hidden");
              }}
              className="mt-4 md:hidden text-xs text-primary hover:underline"
            >
              Show sessions
            </button>
          </div>
        )}
      </div>

      <DetailsPanel
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        sessionKey={activeSessionKey}
        focusedMessage={focusedMessage}
        allMessages={displayMessages}
      />

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
