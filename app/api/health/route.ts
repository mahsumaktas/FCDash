// Health check endpoint — GET /api/health
// Returns gateway connection status, uptime, and version

import { NextResponse } from "next/server";
import { getGateway } from "@/lib/server/gateway-singleton";

export async function GET() {
  const { client } = getGateway();

  const connected = client.isConnected;
  const hello = client.hello;

  return NextResponse.json({
    gateway: connected ? "connected" : "disconnected",
    state: client.state,
    uptime: hello?.snapshot?.uptimeMs ?? null,
    version: hello?.server?.version ?? null,
    connId: hello?.server?.connId ?? null,
    features: hello ? {
      methods: hello.features.methods.length,
      events: hello.features.events.length,
    } : null,
  });
}
