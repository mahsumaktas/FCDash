"use client";
import { useGatewayStore } from "@/stores/gateway";

export function useGateway() {
  return useGatewayStore();
}

export function useIsConnected() {
  return useGatewayStore((s) => s.state === "connected");
}
