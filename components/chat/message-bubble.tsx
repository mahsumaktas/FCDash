"use client";

import { memo } from "react";
import type { ChatMessage } from "@/stores/chat";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, User, AlertCircle, XCircle } from "lucide-react";

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Render message content with basic code block support.
 * If the content contains triple backticks, split and render
 * code sections in <pre><code> blocks.
 */
function MessageContent({ content }: { content: string }) {
  if (!content) return null;

  // Check for code blocks (```...```)
  if (content.includes("```")) {
    const parts = content.split(/(```[\s\S]*?```)/g);
    return (
      <div className="space-y-2">
        {parts.map((part, i) => {
          if (part.startsWith("```") && part.endsWith("```")) {
            // Extract language hint and code
            const inner = part.slice(3, -3);
            const newlineIdx = inner.indexOf("\n");
            const lang =
              newlineIdx > 0 && newlineIdx < 20
                ? inner.slice(0, newlineIdx).trim()
                : "";
            const code =
              newlineIdx > 0 && newlineIdx < 20
                ? inner.slice(newlineIdx + 1)
                : inner;
            return (
              <div key={i} className="relative">
                {lang && (
                  <div className="text-[10px] text-muted-foreground bg-muted/50 px-3 py-1 rounded-t-md border border-b-0 border-border font-mono">
                    {lang}
                  </div>
                )}
                <pre
                  className={`bg-muted/50 border border-border p-3 overflow-x-auto text-xs font-mono ${
                    lang ? "rounded-b-md" : "rounded-md"
                  }`}
                >
                  <code>{code}</code>
                </pre>
              </div>
            );
          }
          // Regular text - render with line breaks preserved
          if (!part.trim()) return null;
          return (
            <span key={i} className="whitespace-pre-wrap">
              {part}
            </span>
          );
        })}
      </div>
    );
  }

  // Plain text with line break support
  return <span className="whitespace-pre-wrap">{content}</span>;
}

/** Streaming indicator dots */
function StreamingDots() {
  return (
    <span className="inline-flex items-center gap-0.5 ml-1">
      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
    </span>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
}

export const MessageBubble = memo(function MessageBubble({
  message,
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
            <MessageContent content={message.content} />
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
              <MessageContent content={message.content} />
              {isDelta && <StreamingDots />}
            </>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground px-1 flex items-center gap-1">
          {formatTimestamp(message.timestamp)}
          {isAborted && (
            <span className="text-muted-foreground/60">(aborted)</span>
          )}
        </div>
      </div>
    </div>
  );
});
