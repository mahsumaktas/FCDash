"use client";

import { useEffect, useState } from "react";

const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
const mod = isMac ? "⌘" : "Ctrl";

const SHORTCUTS = [
  { group: "Navigation", items: [
    { keys: `${mod}+K`, desc: "Open command palette" },
    { keys: `${mod}+B`, desc: "Toggle sidebar" },
    { keys: `${mod}+Shift+O`, desc: "New chat session" },
  ]},
  { group: "Chat", items: [
    { keys: `${mod}+F`, desc: "Search messages" },
    { keys: "Enter", desc: "Send message" },
    { keys: "Shift+Enter", desc: "New line" },
    { keys: "/", desc: "Slash commands" },
    { keys: "Esc", desc: "Close search / panel" },
  ]},
  { group: "General", items: [
    { keys: "?", desc: "Show this help" },
    { keys: `${mod}+\\`, desc: "Toggle details panel" },
  ]},
];

export function KeyboardShortcutsModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Only trigger on ? when not in an input
      if (e.key === "?" && !(e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setOpen(false)}>
      <div
        className="bg-card border border-border rounded-xl shadow-2xl w-[420px] max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold">Keyboard Shortcuts</h2>
          <button onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">
            Esc
          </button>
        </div>
        <div className="px-5 py-3 space-y-4">
          {SHORTCUTS.map((group) => (
            <div key={group.group}>
              <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium mb-2">
                {group.group}
              </h3>
              <div className="space-y-1.5">
                {group.items.map((item) => (
                  <div key={item.keys} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{item.desc}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.split("+").map((key) => (
                        <kbd
                          key={key}
                          className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded border border-border bg-muted text-[10px] font-mono text-muted-foreground"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-border text-[10px] text-muted-foreground/40 text-center">
          Press <kbd className="px-1 rounded border border-border bg-muted mx-0.5">?</kbd> to toggle
        </div>
      </div>
    </div>
  );
}
