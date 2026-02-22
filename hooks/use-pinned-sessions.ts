"use client";

import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "fcdash-pinned-sessions";

function load(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* */ }
  return new Set();
}

function save(pins: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...pins]));
  } catch { /* */ }
}

export function usePinnedSessions() {
  const [pinned, setPinned] = useState<Set<string>>(load);

  useEffect(() => {
    save(pinned);
  }, [pinned]);

  const togglePin = useCallback((key: string) => {
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const isPinned = useCallback((key: string) => pinned.has(key), [pinned]);

  return { pinned, togglePin, isPinned };
}
