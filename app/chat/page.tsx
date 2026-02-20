"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useChat } from "@/hooks/use-chat";
import { SessionList } from "@/components/chat/session-list";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatHeader } from "@/components/chat/chat-header";
import { AgentSelector } from "@/components/chat/agent-selector";
import { MessageSquare, WifiOff } from "lucide-react";

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  // Auto-select session from URL query param
  useEffect(() => {
    if (initialSession && !activeSessionKey) {
      switchSession(initialSession);
    }
  }, [initialSession, activeSessionKey, switchSession]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    // Stick to bottom if within 50px of the end
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 50;
  }, []);

  const handleNewChat = useCallback(
    (agentId: string) => {
      const key = `webchat:fcdash:${Date.now()}`;
      switchSession(key);
      setShowAgentSelector(false);
    },
    [switchSession]
  );

  return (
    <div className="flex h-full">
      {/* Session sidebar */}
      <SessionList
        activeKey={activeSessionKey}
        onSelect={(key) => switchSession(key)}
        onNewChat={() => setShowAgentSelector(true)}
      />

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Connection warning banner */}
        {!isConnected && (
          <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground bg-muted/50 border-b border-border">
            <WifiOff className="w-3.5 h-3.5" />
            <span>
              Not connected to gateway. Chat features are unavailable.
            </span>
          </div>
        )}

        {activeSessionKey ? (
          <>
            <ChatHeader sessionKey={activeSessionKey} />

            {/* Messages area */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
            >
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm">
                    No messages yet. Start the conversation.
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))
              )}
            </div>

            {/* Error display */}
            {error && (
              <div className="px-4 py-2 text-xs text-destructive bg-destructive/10 border-t border-destructive/20">
                {error}
              </div>
            )}

            {/* Message input */}
            <ChatInput
              onSend={sendMessage}
              onAbort={abort}
              isStreaming={isStreaming}
              disabled={!activeSessionKey || !isConnected}
            />
          </>
        ) : (
          /* Empty state when no session is selected */
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MessageSquare className="w-16 h-16 mb-4 opacity-10" />
            <h2 className="text-lg font-medium mb-1">Select a session</h2>
            <p className="text-sm">
              Choose a session from the sidebar or start a new chat
            </p>
          </div>
        )}
      </div>

      {/* Agent selector modal */}
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
