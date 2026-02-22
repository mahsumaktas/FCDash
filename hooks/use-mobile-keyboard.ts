"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Tracks mobile virtual keyboard visibility using the visualViewport API.
 * Returns `keyboardHeight` (px) and `isKeyboardOpen` boolean.
 * Sets CSS custom property `--keyboard-inset` on document.documentElement.
 */
export function useMobileKeyboard() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const prevHeight = useRef(0);

  const update = useCallback(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    // Keyboard height = window height - viewport height - offset
    const kh = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    const rounded = Math.round(kh);

    if (rounded !== prevHeight.current) {
      prevHeight.current = rounded;
      setKeyboardHeight(rounded);
      document.documentElement.style.setProperty(
        "--keyboard-inset",
        `${rounded}px`
      );
    }
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      document.documentElement.style.removeProperty("--keyboard-inset");
    };
  }, [update]);

  return {
    keyboardHeight,
    isKeyboardOpen: keyboardHeight > 100,
  };
}
