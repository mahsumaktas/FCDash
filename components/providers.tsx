"use client";

import { useEffect } from "react";
import { Toaster, toast } from "sonner";
import { useGatewaySSEStore } from "@/stores/gateway-sse";
import { useNotificationStore } from "@/stores/notifications";
import { GatewaySSEProvider } from "@/components/gateway-sse-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  const subscribe = useGatewaySSEStore((s) => s.subscribe);
  const isConnected = useGatewaySSEStore((s) => s.gatewayConnected);
  const addApproval = useNotificationStore((s) => s.addApproval);

  // Subscribe to exec approval events
  useEffect(() => {
    if (!isConnected) return;

    const unsub = subscribe("exec.approval.requested", (event: unknown) => {
      const e = event as Record<string, unknown>;
      const id = String(e.id ?? e.approvalId ?? "");
      if (!id) return;
      addApproval({
        id,
        command: typeof e.command === "string" ? e.command : undefined,
        agentId: typeof e.agentId === "string" ? e.agentId : undefined,
        sessionKey: typeof e.sessionKey === "string" ? e.sessionKey : undefined,
        timestamp: Date.now(),
      });

      // Desktop notification
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("Execution Approval Required", {
          body: typeof e.command === "string" ? e.command.slice(0, 100) : "An agent needs approval",
          icon: "/favicon.ico",
        });
      }

      toast.warning("Exec approval required", {
        description: typeof e.command === "string" ? e.command.slice(0, 80) : undefined,
        duration: 10000,
      });
    });

    return unsub;
  }, [isConnected, subscribe, addApproval]);

  // Request notification permission
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd+B: Toggle sidebar
      if (isMod && e.key === "b") {
        e.preventDefault();
        const sidebar = document.getElementById("app-sidebar");
        sidebar?.classList.toggle("max-md:hidden");
        sidebar?.classList.toggle("hidden");
      }

      // Cmd+Shift+O: New session (dispatch custom event)
      if (isMod && e.shiftKey && e.key === "O") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("fcdash:new-session"));
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <GatewaySSEProvider>
      {children}
      <Toaster position="bottom-right" richColors />
    </GatewaySSEProvider>
  );
}
