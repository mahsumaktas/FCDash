"use client";

import { useState, useCallback, useEffect, useRef } from "react";

type Theme = "light" | "dark" | "system";
const STORAGE_KEY = "fcdash-theme";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const effective = theme === "system" ? getSystemTheme() : theme;
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(effective);
}

export function useTheme() {
  // Always start with "dark" on both server and client to avoid hydration mismatch
  const [theme, setThemeState] = useState<Theme>("dark");
  const mounted = useRef(false);

  // After mount, read the actual theme from localStorage
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      const stored = (localStorage.getItem(STORAGE_KEY) as Theme) ?? "dark";
      if (stored !== "dark") setThemeState(stored);
    }
  }, []);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);

  const cycle = useCallback(() => {
    setThemeState((t) => {
      if (t === "dark") return "light";
      if (t === "light") return "system";
      return "dark";
    });
  }, []);

  return { theme, setTheme, cycle };
}
