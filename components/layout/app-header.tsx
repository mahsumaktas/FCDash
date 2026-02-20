"use client";

import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { useGatewayStore } from "@/stores/gateway";

function getPageTitle(pathname: string): string {
  if (pathname === "/") return "Dashboard";
  const match = NAV_ITEMS.find(
    (item) => item.href !== "/" && pathname.startsWith(item.href)
  );
  return match?.label ?? "FCDash";
}

const STATE_TEXT: Record<string, string> = {
  connected: "Connected",
  connecting: "Connecting...",
  authenticating: "Authenticating...",
  disconnected: "Disconnected",
  error: "Connection Error",
};

export function AppHeader() {
  const pathname = usePathname();
  const connectionState = useGatewayStore((s) => s.state);
  const title = getPageTitle(pathname);

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-4">
      {/* Left: Page title */}
      <h1 className="text-sm font-semibold">{title}</h1>

      {/* Right: Cmd+K hint + connection state */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            document.dispatchEvent(
              new KeyboardEvent("keydown", {
                key: "k",
                metaKey: true,
                bubbles: true,
              })
            );
          }}
          className="flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
        >
          <kbd className="font-mono text-[10px]">⌘K</kbd>
          <span>Search</span>
        </button>
        <span className="text-xs text-muted-foreground">
          {STATE_TEXT[connectionState] ?? "Unknown"}
        </span>
      </div>
    </header>
  );
}
