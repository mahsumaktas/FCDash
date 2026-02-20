"use client";

import { useEffect, useState } from "react";
import { useGatewayStore } from "@/stores/gateway";
import { Badge } from "@/components/ui/badge";
import { Bot, Hash, MessageCircle } from "lucide-react";

function parseSessionKey(key: string) {
  // Session keys look like "telegram:123456" or "webchat:fcdash:1234567890"
  const parts = key.split(":");
  const channel = parts[0] ?? "";
  const id = parts.slice(1).join(":") || key;
  return { channel, id };
}

function channelLabel(channel: string): string {
  const ch = channel.toLowerCase();
  if (ch.includes("telegram")) return "Telegram";
  if (ch.includes("whatsapp")) return "WhatsApp";
  if (ch.includes("discord")) return "Discord";
  if (ch.includes("slack")) return "Slack";
  if (ch.includes("webchat")) return "Web Chat";
  return channel || "Unknown";
}

function channelVariant(
  channel: string
): "default" | "secondary" | "outline" {
  const ch = channel.toLowerCase();
  if (ch.includes("telegram")) return "default";
  if (ch.includes("whatsapp")) return "secondary";
  return "outline";
}

interface ChatHeaderProps {
  sessionKey: string;
}

export function ChatHeader({ sessionKey }: ChatHeaderProps) {
  const rpc = useGatewayStore((s) => s.rpc);
  const isConnected = useGatewayStore((s) => s.state === "connected");
  const [agentId, setAgentId] = useState<string | null>(null);

  const { channel, id } = parseSessionKey(sessionKey);

  // Try to resolve the session to get the agent ID
  useEffect(() => {
    if (!isConnected || !sessionKey) return;
    let cancelled = false;

    (async () => {
      try {
        const result = await rpc("sessions.resolve", { key: sessionKey });
        if (!cancelled && result?.agentId) {
          setAgentId(result.agentId);
        }
      } catch {
        // Session may not exist yet (new webchat)
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rpc, isConnected, sessionKey]);

  return (
    <div className="h-14 border-b border-border flex items-center px-4 gap-3 bg-card/50 shrink-0">
      {/* Bot icon */}
      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Bot className="w-4 h-4" />
      </div>

      {/* Session info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">
            {id || sessionKey}
          </span>
          <Badge variant={channelVariant(channel)} className="text-[10px] h-5">
            {channelLabel(channel)}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {agentId && (
            <span className="flex items-center gap-1">
              <Hash className="w-3 h-3" />
              {agentId}
            </span>
          )}
          <span className="flex items-center gap-1 truncate font-mono text-[10px] opacity-60">
            <MessageCircle className="w-3 h-3" />
            {sessionKey}
          </span>
        </div>
      </div>
    </div>
  );
}
