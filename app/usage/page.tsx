"use client";

import { useState, useEffect, useCallback } from "react";
import { useGatewayStore } from "@/stores/gateway";
import { useIsConnected } from "@/hooks/use-gateway";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, WifiOff, AlertCircle } from "lucide-react";

type UsageData = Record<string, unknown> | null;

export default function UsagePage() {
  const rpc = useGatewayStore((s) => s.rpc);
  const isConnected = useIsConnected();

  const [usageStatus, setUsageStatus] = useState<UsageData>(null);
  const [usageCost, setUsageCost] = useState<UsageData>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const fetchUsage = useCallback(async () => {
    if (!isConnected) return;
    let anySuccess = false;
    try {
      const [statusRes, costRes] = await Promise.allSettled([
        rpc("usage.status"),
        rpc("usage.cost"),
      ]);
      if (statusRes.status === "fulfilled" && statusRes.value) {
        setUsageStatus(statusRes.value as UsageData);
        anySuccess = true;
      }
      if (costRes.status === "fulfilled" && costRes.value) {
        setUsageCost(costRes.value as UsageData);
        anySuccess = true;
      }
      if (!anySuccess) setUnavailable(true);
    } catch {
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, [isConnected, rpc]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  if (!isConnected) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full text-muted-foreground">
        <WifiOff className="w-16 h-16 mb-4 opacity-20" />
        <h2 className="text-lg font-medium mb-1">Not Connected</h2>
        <p className="text-sm">Waiting for gateway connection...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Usage</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Token usage and cost tracking
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : unavailable && !usageStatus && !usageCost ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <AlertCircle className="w-16 h-16 mb-4 opacity-20" />
          <h2 className="text-lg font-medium mb-1">Usage Data Not Available</h2>
          <p className="text-sm">
            This gateway does not provide usage tracking data.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Usage Status */}
          {usageStatus && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Usage Status</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {renderUsageCards(usageStatus)}
              </div>
            </div>
          )}

          {/* Usage Cost */}
          {usageCost && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Cost</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {renderUsageCards(usageCost)}
              </div>
            </div>
          )}

          {!usageStatus && !usageCost && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <BarChart3 className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-sm">No usage data returned.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function renderUsageCards(data: Record<string, unknown>) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;

  return entries.map(([key, value]) => {
    const displayValue =
      typeof value === "number"
        ? formatNumber(value)
        : typeof value === "string"
        ? value
        : JSON.stringify(value);

    const title = key
      .replace(/([A-Z])/g, " $1")
      .replace(/[_-]/g, " ")
      .replace(/^\w/, (c) => c.toUpperCase())
      .trim();

    return (
      <Card key={key}>
        <CardHeader className="pb-0">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <span className="text-xl font-semibold">{displayValue}</span>
        </CardContent>
      </Card>
    );
  });
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  if (n % 1 !== 0) return n.toFixed(4);
  return n.toLocaleString();
}
