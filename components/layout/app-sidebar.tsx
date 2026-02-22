"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Sun, Moon, Monitor, Menu, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";
import { useGatewaySSEStore } from "@/stores/gateway-sse";
import { useNotificationStore } from "@/stores/notifications";
import { useTheme } from "@/hooks/use-theme";
import { clearAuthCookie } from "@/lib/auth";
import { pulseVariants, sidebarVariants } from "@/lib/animations";
import { useState, useEffect, useRef, useCallback } from "react";

const STATUS_DOT: Record<string, string> = {
  connected: "bg-green-500",
  connecting: "bg-yellow-500",
  authenticating: "bg-yellow-500",
  disconnected: "bg-red-500",
  error: "bg-red-500",
};

const STATUS_LABEL: Record<string, string> = {
  connected: "Connected",
  connecting: "Connecting...",
  authenticating: "Authenticating...",
  disconnected: "Disconnected",
  error: "Error",
};

const THEME_ICON = {
  dark: Moon,
  light: Sun,
  system: Monitor,
};

const THEME_LABEL = {
  dark: "Dark",
  light: "Light",
  system: "System",
};

// Swipe detection constants
const SWIPE_THRESHOLD = 50;
const EDGE_ZONE = 30; // px from left edge to start swipe

export function AppSidebar() {
  const pathname = usePathname();
  const connectionState = useGatewaySSEStore((s) => s.gatewayState);
  const pendingApprovals = useNotificationStore((s) => s.pendingApprovals);
  const { theme, cycle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const ThemeIcon = THEME_ICON[theme];
  const isConnecting = connectionState === "connecting" || connectionState === "authenticating";

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Listen for toggle event from MobileSidebarToggle button
  useEffect(() => {
    const handler = () => setMobileOpen((v) => !v);
    window.addEventListener("fcdash:toggle-mobile-sidebar", handler);
    return () => window.removeEventListener("fcdash:toggle-mobile-sidebar", handler);
  }, []);

  // ── Swipe gesture for mobile sidebar ───────────────────────────────────

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;

      // Only detect swipe-right from left edge (open) or anywhere (close)
      if (!mobileOpen && touch.clientX > EDGE_ZONE) return;

      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
    },
    [mobileOpen]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!touchStartRef.current) return;
      const touch = e.changedTouches[0];
      if (!touch) return;

      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      const dt = Date.now() - touchStartRef.current.time;
      touchStartRef.current = null;

      // Must be primarily horizontal and fast enough
      if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dy) > Math.abs(dx) || dt > 500) return;

      if (dx > 0 && !mobileOpen) {
        setMobileOpen(true);
      } else if (dx < 0 && mobileOpen) {
        setMobileOpen(false);
      }
    },
    [mobileOpen]
  );

  useEffect(() => {
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchEnd]);

  // ── Logout ─────────────────────────────────────────────────────────────

  const handleLogout = () => {
    clearAuthCookie();
    window.location.href = "/login";
  };

  const sidebarContent = (
    <>
      {/* Branding */}
      <div className="flex h-12 items-center gap-2 border-b border-sidebar-border px-4">
        <Terminal className="h-5 w-5 text-sidebar-primary" />
        <span className="text-sm font-semibold tracking-tight">FCDash</span>
        <div className="ml-auto flex items-center gap-1.5">
          {isConnecting ? (
            <motion.span
              variants={pulseVariants}
              initial="initial"
              animate="animate"
              className={cn("h-2 w-2 rounded-full", STATUS_DOT[connectionState] ?? "bg-red-500")}
            />
          ) : (
            <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[connectionState] ?? "bg-red-500")} />
          )}
          <span className="text-[10px] text-muted-foreground">
            {STATUS_LABEL[connectionState] ?? "Unknown"}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-all duration-150",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.badge && pendingApprovals.length > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-medium text-destructive-foreground"
                    >
                      {pendingApprovals.length}
                    </motion.span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-4 py-2 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">FCDash v1.0</span>
        <div className="flex items-center gap-1">
          <button
            onClick={cycle}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-sidebar-accent/50"
            title={`Theme: ${THEME_LABEL[theme]}`}
          >
            <ThemeIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-sidebar-accent/50"
            title="Logout"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="flex h-full w-60 flex-col border-r border-sidebar-border bg-sidebar-background text-sidebar-foreground max-md:hidden" id="app-sidebar">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              variants={sidebarVariants}
              initial="closed"
              animate="open"
              exit="closed"
              className="fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-sidebar-border bg-sidebar-background text-sidebar-foreground md:hidden"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

/* Mobile sidebar toggle button (used in header) */

export function MobileSidebarToggle() {
  return (
    <button
      className="md:hidden p-1.5 rounded-md hover:bg-accent transition-colors"
      onClick={() => {
        window.dispatchEvent(new CustomEvent("fcdash:toggle-mobile-sidebar"));
      }}
    >
      <Menu className="w-5 h-5" />
    </button>
  );
}
