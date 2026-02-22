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
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Send, Square, Paperclip, X, Image as ImageIcon } from "lucide-react";
import type { Attachment } from "@/stores/chat";
import { api } from "@/lib/api-client";
import { useChatStore } from "@/stores/chat";
import { getModelColor, getShortModelName } from "@/lib/model-utils";

// ─── Slash Commands ──────────────────────────────────────────────────────────

interface SlashCommand {
  cmd: string;
  args: string;
  desc: string;
}

const COMMANDS: SlashCommand[] = [
  { cmd: "/model", args: "<model-id>", desc: "Set session model" },
  { cmd: "/models", args: "", desc: "List available models" },
  { cmd: "/status", args: "", desc: "Show session status" },
  { cmd: "/help", args: "", desc: "Show all commands" },
  { cmd: "/clear", args: "", desc: "Clear session history" },
  { cmd: "/thinking", args: "on|off", desc: "Toggle extended thinking" },
  { cmd: "/verbose", args: "on|off", desc: "Toggle verbose mode" },
  { cmd: "/label", args: "<text>", desc: "Set session label" },
  { cmd: "/agent", args: "<agent-id>", desc: "Switch agent" },
  { cmd: "/compact", args: "", desc: "Compact session context" },
];

function getMatchingCommands(value: string): SlashCommand[] {
  if (!value.startsWith("/")) return [];
  if (value.indexOf(" ") !== -1) return [];
  const prefix = value.toLowerCase();
  return COMMANDS.filter((c) => c.cmd.startsWith(prefix));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Draft persistence ───────────────────────────────────────────────────────

function getDraft(sessionKey?: string): string {
  if (!sessionKey || typeof window === "undefined") return "";
  try { return sessionStorage.getItem(`fcdash-draft-${sessionKey}`) ?? ""; } catch { return ""; }
}

function saveDraft(sessionKey: string | undefined, value: string) {
  if (!sessionKey) return;
  try {
    if (value) sessionStorage.setItem(`fcdash-draft-${sessionKey}`, value);
    else sessionStorage.removeItem(`fcdash-draft-${sessionKey}`);
  } catch { /* */ }
}

// ─── Model Badge (read-only, shows current model) ───────────────────────────

function ModelBadge() {
  const sessionModel = useChatStore((s) => s.sessionModel);
  const sessionUsage = useChatStore((s) => s.sessionUsage);
  const effectiveModel = sessionModel ?? sessionUsage?.model;
  if (!effectiveModel) return null;
  const short = getShortModelName(effectiveModel) ?? effectiveModel;
  const color = getModelColor(effectiveModel);
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md ${color.bg} ${color.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
      <span className="truncate max-w-[140px]">{short}</span>
    </span>
  );
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface ChatInputProps {
  onSend: (text: string, attachments?: Attachment[]) => void;
  onAbort: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  sessionKey?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ChatInput({
  onSend,
  onAbort,
  isStreaming,
  disabled = false,
  sessionKey,
}: ChatInputProps) {
  const [value, setValue] = useState(() => getDraft(sessionKey));
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [dragging, setDragging] = useState(false);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteItems, setPaletteItems] = useState<SlashCommand[]>([]);
  const [paletteIndex, setPaletteIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Restore draft when session changes
  useEffect(() => {
    setValue(getDraft(sessionKey));
  }, [sessionKey]);

  // Auto-save draft
  useEffect(() => {
    saveDraft(sessionKey, value);
  }, [value, sessionKey]);

  // CSS variable injection for composer height
  useEffect(() => {
    if (!wrapperRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        document.documentElement.style.setProperty(
          "--chat-composer-height",
          `${entry.contentRect.height}px`
        );
      }
    });
    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, []);

  // Height adjustment - improved auto-resize
  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  // Palette logic
  const updatePalette = useCallback((text: string) => {
    const matches = getMatchingCommands(text);
    if (matches.length > 0) {
      setPaletteItems(matches);
      setPaletteIndex(0);
      setPaletteOpen(true);
    } else {
      setPaletteOpen(false);
      setPaletteItems([]);
    }
  }, []);

  const closePalette = useCallback(() => {
    setPaletteOpen(false);
    setPaletteItems([]);
    setPaletteIndex(0);
  }, []);

  const selectCommand = useCallback((cmd: SlashCommand) => {
    const newValue = cmd.cmd + " ";
    setValue(newValue);
    closePalette();
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const len = newValue.length;
        textareaRef.current.setSelectionRange(len, len);
      }
    });
  }, [closePalette]);

  useEffect(() => {
    if (!paletteOpen) return;
    const el = paletteRef.current?.querySelector<HTMLElement>(`[data-palette-index="${paletteIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [paletteIndex, paletteOpen]);

  // File helpers
  const addFiles = useCallback(async (files: File[]) => {
    const results = await Promise.all(files.map(fileToAttachment));
    setAttachments((prev) => [...prev, ...results]);
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Drag & drop / paste
  const onDragOver = (e: DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) await addFiles(files);
  };

  const onPaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
    if (files.length > 0) {
      e.preventDefault();
      await addFiles(files);
    }
  };

  // Send
  const handleSend = useCallback(async () => {
    const trimmed = value.trim();
    if ((!trimmed && attachments.length === 0) || disabled) return;

    if (trimmed.startsWith("/model ") && sessionKey) {
      const modelId = trimmed.slice("/model ".length).trim();
      if (modelId) {
        api.rpc("sessions.patch", { key: sessionKey, model: modelId }).catch(
          (err: unknown) => console.warn("[chat-input] sessions.patch failed", err)
        );
      }
    }

    onSend(trimmed, attachments.length > 0 ? attachments : undefined);
    setValue("");
    setAttachments([]);
    closePalette();
    saveDraft(sessionKey, "");
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    });
  }, [value, attachments, disabled, onSend, sessionKey, closePalette]);

  // Keyboard with improved navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (paletteOpen) {
        if (e.key === "ArrowDown") { e.preventDefault(); setPaletteIndex((i) => Math.min(i + 1, paletteItems.length - 1)); return; }
        if (e.key === "ArrowUp") { e.preventDefault(); setPaletteIndex((i) => Math.max(i - 1, 0)); return; }
        if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) { e.preventDefault(); if (paletteItems[paletteIndex]) selectCommand(paletteItems[paletteIndex]); return; }
        if (e.key === "Escape") { e.preventDefault(); closePalette(); return; }
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (isStreaming) return;
        handleSend();
      }
    },
    [paletteOpen, paletteItems, paletteIndex, selectCommand, closePalette, handleSend, isStreaming]
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setValue(next);
    updatePalette(next);
  }, [updatePalette]);

  const canSend = (value.trim().length > 0 || attachments.length > 0) && !isStreaming && !disabled;
  const hasDraft = value.length > 0;

  return (
    <div
      ref={wrapperRef}
      className={`border-t border-border bg-card/50 transition-colors ${dragging ? "bg-primary/5 border-primary/30" : ""}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Attachment previews with thumbnails */}
      <AnimatePresence>
        {attachments.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-wrap gap-2 px-3 pt-3 overflow-hidden"
          >
            {attachments.map((att) => (
              <motion.div
                key={att.id}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="relative group"
              >
                {att.isImage ? (
                  <img src={att.dataUrl} alt={att.name} className="h-16 w-16 object-cover rounded-md border border-border" />
                ) : (
                  <div className="h-16 w-20 flex flex-col items-center justify-center rounded-md border border-border bg-muted/40 px-2">
                    <span className="text-[10px] text-muted-foreground truncate w-full text-center mt-1">{att.name}</span>
                    <span className="text-[9px] text-muted-foreground/50">{(att.size / 1024).toFixed(0)} KB</span>
                  </div>
                )}
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Command palette */}
      <AnimatePresence>
        {paletteOpen && paletteItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="px-3 max-w-4xl mx-auto"
          >
            <div ref={paletteRef} className="mb-1 rounded-lg border border-border bg-popover shadow-md overflow-y-auto" style={{ maxHeight: "200px" }} role="listbox">
              {paletteItems.map((item, idx) => (
                <button
                  key={item.cmd}
                  data-palette-index={idx}
                  role="option"
                  aria-selected={idx === paletteIndex}
                  onMouseDown={(e) => { e.preventDefault(); selectCommand(item); }}
                  onMouseEnter={() => setPaletteIndex(idx)}
                  className={`w-full flex items-baseline gap-3 px-3 py-2 text-left text-sm transition-colors ${
                    idx === paletteIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50 text-popover-foreground"
                  }`}
                >
                  <span className="font-mono font-semibold shrink-0 text-primary">{item.cmd}</span>
                  {item.args && <span className="font-mono text-xs text-muted-foreground shrink-0">{item.args}</span>}
                  <span className="text-muted-foreground truncate">{item.desc}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-end gap-2 p-3 max-w-4xl mx-auto">
        <Button variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground mb-0.5" title="Attach file" disabled={disabled} onClick={() => fileInputRef.current?.click()}>
          <Paperclip className="w-4 h-4" />
        </Button>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={async (e) => { const files = Array.from(e.target.files ?? []); if (files.length > 0) await addFiles(files); e.target.value = ""; }} />

        <Button variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground mb-0.5 max-sm:hidden" title="Attach image" disabled={disabled}
          onClick={() => { const input = document.createElement("input"); input.type = "file"; input.accept = "image/*"; input.multiple = true; input.onchange = async () => { const files = Array.from(input.files ?? []); if (files.length > 0) await addFiles(files); }; input.click(); }}
        >
          <ImageIcon className="w-4 h-4" />
        </Button>

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={onPaste}
            placeholder={disabled ? "Select a session to start chatting..." : dragging ? "Drop files here..." : "Type a message or / for commands..."}
            disabled={disabled}
            rows={1}
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ minHeight: "40px", maxHeight: "200px" }}
          />
          {hasDraft && !disabled && (
            <button
              onClick={() => { setValue(""); saveDraft(sessionKey, ""); }}
              className="absolute right-2 top-2 p-0.5 rounded text-muted-foreground/30 hover:text-muted-foreground transition-colors"
              title="Clear draft"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Send/abort button with animation */}
        <AnimatePresence mode="wait">
          {isStreaming ? (
            <motion.div
              key="abort"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Button variant="destructive" size="icon-sm" onClick={onAbort} className="shrink-0 mb-0.5" title="Stop generating">
                <Square className="w-3.5 h-3.5" />
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="send"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Button
                variant="default"
                size="icon-sm"
                onClick={handleSend}
                disabled={!canSend}
                className="shrink-0 mb-0.5"
                title="Send"
              >
                <motion.div whileTap={{ scale: 0.9 }}>
                  <Send className="w-3.5 h-3.5" />
                </motion.div>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer with model selector */}
      <div className="flex items-center justify-between px-3 pb-2 max-w-4xl mx-auto">
        <ModelBadge />
        <span className="text-[10px] text-muted-foreground/30">Shift+Enter for new line</span>
      </div>
    </div>
  );
}
