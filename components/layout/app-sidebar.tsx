"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";
import { useGatewayStore } from "@/stores/gateway";
import { useNotificationStore } from "@/stores/notifications";

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

export function AppSidebar() {
  const pathname = usePathname();
  const connectionState = useGatewayStore((s) => s.state);
  const pendingApprovals = useNotificationStore((s) => s.pendingApprovals);

  return (
    <aside className="flex h-full w-60 flex-col border-r border-sidebar-border bg-sidebar-background text-sidebar-foreground">
      {/* Branding */}
      <div className="flex h-12 items-center gap-2 border-b border-sidebar-border px-4">
        <Terminal className="h-5 w-5 text-sidebar-primary" />
        <span className="text-sm font-semibold tracking-tight">FCDash</span>
        <div className="ml-auto flex items-center gap-1.5">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              STATUS_DOT[connectionState] ?? "bg-red-500"
            )}
          />
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
                    "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.badge && pendingApprovals.length > 0 && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-medium text-destructive-foreground">
                      {pendingApprovals.length}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-4 py-2">
        <span className="text-[10px] text-muted-foreground">FCDash v1.0</span>
      </div>
    </aside>
  );
}
