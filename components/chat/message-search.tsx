"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronUp, ChevronDown, X } from "lucide-react";
import type { ChatMessage } from "@/stores/chat";

interface MessageSearchProps {
  open: boolean;
  messages: ChatMessage[];
  onClose: () => void;
  onMatchFocus: (messageId: string) => void;
}

export function MessageSearch({ open, messages, onClose, onMatchFocus }: MessageSearchProps) {
  const [query, setQuery] = useState("");
  const [matchIds, setMatchIds] = useState<string[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setMatchIds([]);
      setCurrentIdx(0);
    }
  }, [open]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        if (!open) onMatchFocus("");
      }
      if (e.key === "Escape" && open) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, onMatchFocus]);

  useEffect(() => {
    if (!query.trim()) {
      setMatchIds([]);
      setCurrentIdx(0);
      return;
    }
    const q = query.toLowerCase();
    const ids = messages
      .filter((m) => m.content.toLowerCase().includes(q))
      .map((m) => m.id);
    setMatchIds(ids);
    setCurrentIdx(0);
    if (ids.length > 0) onMatchFocus(ids[0]);
  }, [query, messages, onMatchFocus]);

  const goNext = useCallback(() => {
    if (matchIds.length === 0) return;
    const next = (currentIdx + 1) % matchIds.length;
    setCurrentIdx(next);
    onMatchFocus(matchIds[next]);
  }, [matchIds, currentIdx, onMatchFocus]);

  const goPrev = useCallback(() => {
    if (matchIds.length === 0) return;
    const prev = (currentIdx - 1 + matchIds.length) % matchIds.length;
    setCurrentIdx(prev);
    onMatchFocus(matchIds[prev]);
  }, [matchIds, currentIdx, onMatchFocus]);

  if (!open) return null;

  return (
    <div className="border-b border-border bg-card/80 backdrop-blur-sm px-4 py-2 flex items-center gap-2 shrink-0">
      <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.shiftKey ? goPrev() : goNext();
        }}
        placeholder="Search messages..."
        className="h-7 text-xs border-0 bg-transparent focus-visible:ring-0 p-0 flex-1"
      />
      {query && (
        <span className="text-xs text-muted-foreground shrink-0">
          {matchIds.length > 0 ? `${currentIdx + 1}/${matchIds.length}` : "No matches"}
        </span>
      )}
      <Button variant="ghost" size="icon-sm" onClick={goPrev} disabled={matchIds.length === 0}>
        <ChevronUp className="w-3.5 h-3.5" />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={goNext} disabled={matchIds.length === 0}>
        <ChevronDown className="w-3.5 h-3.5" />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={onClose}>
        <X className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
