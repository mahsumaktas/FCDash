"use client";

import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { useGatewaySSEStore } from "@/stores/gateway-sse";
import { useChatStore } from "@/stores/chat";
import { MobileSidebarToggle } from "./app-sidebar";
import { getModelColor, getShortModelName, getContextPercent, estimateCost } from "@/lib/model-utils";
import { Zap } from "lucide-react";

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

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function UsagePill() {
  const sessionModel = useChatStore((s) => s.sessionModel);
  const sessionUsage = useChatStore((s) => s.sessionUsage);
  const effectiveModel = sessionModel ?? sessionUsage?.model;
  const totalTokens = sessionUsage?.totalTokens ?? 0;

  if (!effectiveModel && totalTokens === 0) return null;

  const color = getModelColor(effectiveModel);
  const short = getShortModelName(effectiveModel);
  const ctxPercent = getContextPercent(effectiveModel, totalTokens);
  const cost = sessionUsage?.totalCost ?? estimateCost(effectiveModel, sessionUsage?.inputTokens ?? 0, sessionUsage?.outputTokens ?? 0) ?? 0;
  const isEstimated = !(sessionUsage?.totalCost && sessionUsage.totalCost > 0);

  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-card/80 px-2.5 py-1 text-[10px]">
      {short && (
        <span className={`inline-flex items-center gap-1 ${color.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
          {short}
        </span>
      )}
      {totalTokens > 0 && (
        <>
          <span className="text-muted-foreground/40">|</span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Zap className="w-2.5 h-2.5" />
            {fmtTokens(totalTokens)}
          </span>
          {cost > 0 && (
            <span className="text-muted-foreground/60">
              {isEstimated ? "~" : ""}${cost.toFixed(2)}
            </span>
          )}
          <div className="w-10 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                ctxPercent > 80 ? "bg-destructive" : ctxPercent > 50 ? "bg-amber-400" : "bg-emerald-400"
              }`}
              style={{ width: `${Math.min(100, ctxPercent)}%` }}
            />
          </div>
          <span className="text-muted-foreground/50">{ctxPercent}%</span>
        </>
      )}
    </div>
  );
}

export function AppHeader() {
  const pathname = usePathname();
  const connectionState = useGatewaySSEStore((s) => s.gatewayState);
  const title = getPageTitle(pathname);

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-4">
      {/* Left: Mobile menu + Page title */}
      <div className="flex items-center gap-2">
        <MobileSidebarToggle />
        <h1 className="text-sm font-semibold">{title}</h1>
      </div>

      {/* Right: Usage pill + Cmd+K hint + connection state */}
      <div className="flex items-center gap-3">
        <UsagePill />
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
          className="flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted max-sm:hidden"
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
