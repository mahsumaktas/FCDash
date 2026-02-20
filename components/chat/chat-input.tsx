"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type KeyboardEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { Send, Square, Mic } from "lucide-react";

interface ChatInputProps {
  onSend: (text: string) => void;
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea based on content
  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    // Clamp between 1 row (~40px) and ~6 rows (~160px)
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    // Reset height after clearing
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    });
  }, [value, disabled, onSend]);

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

  const canSend = value.trim().length > 0 && !isStreaming && !disabled;

  return (
    <div className="border-t border-border bg-card/50 p-3">
      <div className="flex items-end gap-2 max-w-4xl mx-auto">
        {/* Mic button placeholder */}
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-muted-foreground mb-0.5"
          title="Voice input (coming soon)"
          disabled
        >
          <Mic className="w-4 h-4" />
        </Button>

        {/* Auto-resize textarea */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              disabled
                ? "Select a session to start chatting..."
                : "Type a message... (Shift+Enter for new line)"
            }
            disabled={disabled}
            rows={1}
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ minHeight: "40px", maxHeight: "160px" }}
          />
        </div>

        {/* Send or Abort button */}
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
            title="Send message"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
