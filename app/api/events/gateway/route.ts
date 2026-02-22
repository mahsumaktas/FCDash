// Unified SSE endpoint for all gateway events — GET /api/events/gateway
// Streams every gateway event through a single SSE connection.
// Replaces per-topic SSE endpoints (health, chat, approvals) for the browser.

import { type NextRequest, NextResponse } from "next/server";
import { getGateway } from "@/lib/server/gateway-singleton";
import { validateRequest } from "@/lib/server/auth";
import { createSSEStream } from "@/lib/server/sse";
import type { GatewayEventName } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Events forwarded from the server-side gateway to the browser */
const FORWARDED_EVENTS: GatewayEventName[] = [
  "health",
  "presence",
  "tick",
  "heartbeat",
  "shutdown",
  "chat",
  "exec.approval.requested",
  "exec.approval.resolved",
  "device.pair.requested",
  "device.pair.resolved",
  "node.pair.requested",
  "node.pair.resolved",
  "voicewake.changed",
  "talk.mode",
  "cron",
];

export async function GET(request: NextRequest) {
  const auth = validateRequest(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: { code: "unauthorized", message: "Unauthorized" } },
      { status: 401 },
    );
  }

  const { client, bus } = getGateway();

  return createSSEStream(request, (send) => {
    // Send initial gateway state
    send.event("gateway.state", {
      state: client.state,
      connected: client.isConnected,
    });

    // Forward gateway.state changes (synthetic event from gateway-singleton)
    const unsubState = bus.on("gateway.state" as GatewayEventName, (payload) => {
      send.event("gateway.state", payload);
    });

    // Forward all real gateway events
    const unsubs = FORWARDED_EVENTS.map((event) =>
      bus.on(event, (payload) => {
        send.event(event, payload);
      }),
    );

    return () => {
      unsubState();
      unsubs.forEach((u) => u());
    };
  });
}
