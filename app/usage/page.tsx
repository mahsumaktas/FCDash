"use client";

import { useState, useMemo } from "react";
import { useApiQuery } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/animations";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  BarChart3,
  WifiOff,
  AlertCircle,
  Coins,
  Zap,
  DollarSign,
  Hash,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type ProviderWindow = {
  label: string;
  usedPercent: number;
  resetAt?: number;
};

type ProviderUsage = {
  provider: string;
  displayName: string;
  windows: ProviderWindow[];
  plan?: string;
  error?: string;
};

type UsageStatusResult = {
  updatedAt: number;
  providers: ProviderUsage[];
};

type DailyCostEntry = {
  date: string;
  totalTokens: number;
  totalCost: number;
  input: number;
  output: number;
  inputCost?: number;
  outputCost?: number;
};

type UsageCostResult = {
  daily: DailyCostEntry[];
  totals: {
    totalTokens: number;
    totalCost: number;
    input?: number;
    output?: number;
  };
};

type SessionUsageEntry = {
  key: string;
  label?: string;
  agentId?: string;
  channel?: string;
  model?: string;
  usage: {
    totalTokens: number;
    totalCost: number;
    input?: number;
    output?: number;
  };
};

type AggregateEntry = {
  name?: string;
  key?: string;
  totalTokens: number;
  totalCost: number;
  count?: number;
  sessions?: number;
};

type SessionsUsageResult = {
  sessions: SessionUsageEntry[];
  totals: {
    totalTokens: number;
    totalCost: number;
  };
  aggregates: {
    byModel?: AggregateEntry[];
    byProvider?: AggregateEntry[];
    byChannel?: AggregateEntry[];
    byAgent?: AggregateEntry[];
    daily?: DailyCostEntry[];
  };
};

// ─── Chart Colors ────────────────────────────────────────────────────────────

const CHART_COLORS = {
  input: "#8b5cf6",
  output: "#10b981",
  cost: "#f59e0b",
};

const PIE_COLORS = [
  "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4",
  "#f97316", "#ec4899", "#14b8a6", "#a855f7", "#6366f1",
];

// ─── Date Range Options ──────────────────────────────────────────────────────

const DATE_RANGES = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
] as const;

type DateRange = (typeof DATE_RANGES)[number];

// Cost alert threshold (configurable)
const DAILY_COST_ALERT_THRESHOLD = 5.0; // $5/day

// ─── Animated Number ─────────────────────────────────────────────────────────

function AnimatedValue({ value, prefix = "", suffix = "" }: { value: string; prefix?: string; suffix?: string }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="text-xl font-bold"
    >
      {prefix}{value}{suffix}
    </motion.span>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function UsagePage() {
  const [dateRange, setDateRange] = useState<DateRange>(DATE_RANGES[2]);

  const { data: statusRaw, loading: statusLoading, error: statusError, lastUpdated, refetch: refetchStatus } = useApiQuery({
    method: "usage.status",
    pollInterval: 30_000,
  });

  const { data: costRaw, loading: costLoading, error: costError, refetch: refetchCost } = useApiQuery({
    method: "usage.cost",
    params: { days: dateRange.days },
    pollInterval: 30_000,
  });

  const { data: sessionsRaw, loading: sessionsLoading, error: sessionsError, refetch: refetchSessions } = useApiQuery({
    method: "sessions.usage",
    params: { limit: 50 },
    pollInterval: 30_000,
  });

  const loading = statusLoading || costLoading || sessionsLoading;
  const usageStatus = statusRaw as UsageStatusResult | null;
  const usageCost = costRaw as UsageCostResult | null;
  const sessionsUsage = sessionsRaw as SessionsUsageResult | null;
  const unavailable = !loading && !!statusError && !!costError && !!sessionsError && !usageStatus && !usageCost && !sessionsUsage;

  const handleRefresh = () => {
    refetchStatus();
    refetchCost();
    refetchSessions();
  };

  // ─── Derived values ────────────────────────────────────────────────────

  const totalTokens = usageCost?.totals?.totalTokens ?? sessionsUsage?.totals?.totalTokens ?? 0;
  const totalCost = usageCost?.totals?.totalCost ?? sessionsUsage?.totals?.totalCost ?? 0;
  const sessionCountFromUsage = sessionsUsage?.sessions?.length ?? 0;
  const avgCostPerSession =
    sessionCountFromUsage > 0 ? totalCost / sessionCountFromUsage : 0;

  // Chart data
  const tokenChartData = useMemo(() => {
    const daily = usageCost?.daily ?? sessionsUsage?.aggregates?.daily ?? [];
    return daily.map((d) => ({
      date: formatShortDate(d.date),
      input: d.input ?? 0,
      output: d.output ?? 0,
    }));
  }, [usageCost, sessionsUsage]);

  const costChartData = useMemo(() => {
    const daily = usageCost?.daily ?? sessionsUsage?.aggregates?.daily ?? [];
    return daily.map((d) => ({
      date: formatShortDate(d.date),
      cost: d.totalCost ?? 0,
    }));
  }, [usageCost, sessionsUsage]);

  // Model breakdown for pie chart
  const byModel = sessionsUsage?.aggregates?.byModel ?? [];
  const byProvider = sessionsUsage?.aggregates?.byProvider ?? [];
  const byAgent = sessionsUsage?.aggregates?.byAgent ?? [];
  const byChannel = sessionsUsage?.aggregates?.byChannel ?? [];

  const modelPieData = useMemo(() => {
    return byModel
      .filter((m) => m.totalCost > 0)
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 8)
      .map((m) => ({
        name: m.name || m.key || "unknown",
        value: m.totalCost,
      }));
  }, [byModel]);

  // Cost alert: check if any day exceeds threshold
  const costAlertDays = useMemo(() => {
    const daily = usageCost?.daily ?? sessionsUsage?.aggregates?.daily ?? [];
    return daily.filter((d) => d.totalCost > DAILY_COST_ALERT_THRESHOLD);
  }, [usageCost, sessionsUsage]);

  // ─── Error state ────────────────────────────────────────────────────────

  if (statusError && costError && sessionsError && !usageStatus && !usageCost && !sessionsUsage && !loading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full text-muted-foreground">
        <WifiOff className="w-16 h-16 mb-4 opacity-20" />
        <h2 className="text-lg font-medium mb-1">Unable to Load Usage Data</h2>
        <p className="text-sm">{statusError.message}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={handleRefresh}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with date range */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Usage & Costs</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-muted-foreground text-sm">
              Token usage, costs, and provider rate limits
            </p>
            {lastUpdated && (
              <span className="text-[10px] text-muted-foreground">
                Updated {new Date(lastUpdated).toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={handleRefresh}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {DATE_RANGES.map((range) => (
            <button
              key={range.label}
              onClick={() => setDateRange(range)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                dateRange.label === range.label
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cost Alert */}
      <AnimatePresence>
        {costAlertDays.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              <div className="text-sm">
                <span className="font-medium text-amber-500">Cost Alert:</span>{" "}
                {costAlertDays.length} day(s) exceeded ${DAILY_COST_ALERT_THRESHOLD.toFixed(2)} threshold.
                Highest: ${Math.max(...costAlertDays.map((d) => d.totalCost)).toFixed(3)}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unavailable state */}
      {unavailable ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <AlertCircle className="w-16 h-16 mb-4 opacity-20" />
          <h2 className="text-lg font-medium mb-1">Usage Data Not Available</h2>
          <p className="text-sm">
            This gateway does not provide usage tracking data.
          </p>
        </div>
      ) : (
        <>
          {/* KPI Row */}
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <motion.div variants={staggerItem}>
              <KPICard
                title="Total Tokens"
                value={formatCompactNumber(totalTokens)}
                icon={<Zap className="w-4 h-4" />}
                loading={loading}
              />
            </motion.div>
            <motion.div variants={staggerItem}>
              <KPICard
                title="Total Cost"
                value={`$${totalCost.toFixed(3)}`}
                icon={<DollarSign className="w-4 h-4" />}
                loading={loading}
              />
            </motion.div>
            <motion.div variants={staggerItem}>
              <KPICard
                title="Sessions"
                value={sessionCountFromUsage.toString()}
                icon={<Hash className="w-4 h-4" />}
                loading={loading}
              />
            </motion.div>
            <motion.div variants={staggerItem}>
              <KPICard
                title="Avg Cost/Session"
                value={`$${avgCostPerSession.toFixed(4)}`}
                icon={<Coins className="w-4 h-4" />}
                loading={loading}
              />
            </motion.div>
          </motion.div>

          {/* Provider Rate Limits */}
          {(loading || (usageStatus?.providers && usageStatus.providers.length > 0)) && (
            <div>
              <h2 className="text-lg font-semibold mb-3">Provider Rate Limits</h2>
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i}>
                      <CardHeader className="pb-2">
                        <Skeleton className="h-5 w-32" />
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {usageStatus!.providers.map((provider) => (
                    <ProviderCard key={provider.provider} provider={provider} />
                  ))}
                </div>
              )}
              {usageStatus?.updatedAt && (
                <p className="text-xs text-muted-foreground mt-2">
                  Updated {formatTimeAgo(usageStatus.updatedAt)}
                </p>
              )}
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Daily Token Trend */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card>
                <CardHeader className="pb-0">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Daily Token Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-[260px] w-full" />
                  ) : tokenChartData.length === 0 ? (
                    <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
                      No token data available
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart
                        data={tokenChartData}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="usageGradInput" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={CHART_COLORS.input} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={CHART_COLORS.input} stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="usageGradOutput" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={CHART_COLORS.output} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={CHART_COLORS.output} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={formatCompactNumber}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: 12,
                          }}
                          labelStyle={{ color: "hsl(var(--foreground))" }}
                          formatter={(value: number) => [formatCompactNumber(value), undefined]}
                        />
                        <Area
                          type="monotone"
                          dataKey="input"
                          stackId="1"
                          stroke={CHART_COLORS.input}
                          fill="url(#usageGradInput)"
                          strokeWidth={2}
                          name="Input"
                        />
                        <Area
                          type="monotone"
                          dataKey="output"
                          stackId="1"
                          stroke={CHART_COLORS.output}
                          fill="url(#usageGradOutput)"
                          strokeWidth={2}
                          name="Output"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Daily Cost Trend */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card>
                <CardHeader className="pb-0">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Daily Cost Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-[260px] w-full" />
                  ) : costChartData.length === 0 ? (
                    <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
                      No cost data available
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart
                        data={costChartData}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: 12,
                          }}
                          labelStyle={{ color: "hsl(var(--foreground))" }}
                          formatter={(value: number) => [`$${value.toFixed(4)}`, "Cost"]}
                        />
                        <Bar
                          dataKey="cost"
                          fill={CHART_COLORS.cost}
                          radius={[4, 4, 0, 0]}
                          name="Cost"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Model Breakdown Pie Chart */}
          {!loading && modelPieData.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <Card>
                <CardHeader className="pb-0">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Cost by Model
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={modelPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={110}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }: { name: string; percent: number }) =>
                          `${name} (${(percent * 100).toFixed(1)}%)`
                        }
                        labelLine={{ strokeWidth: 1 }}
                      >
                        {modelPieData.map((_, idx) => (
                          <Cell
                            key={idx}
                            fill={PIE_COLORS[idx % PIE_COLORS.length]}
                            strokeWidth={0}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: 12,
                        }}
                        formatter={(value: number) => [`$${value.toFixed(4)}`, "Cost"]}
                      />
                      {/* Custom legend below chart */}
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-3 mt-2">
                    {modelPieData.map((entry, idx) => (
                      <div key={entry.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                        />
                        {entry.name}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Breakdown Tables */}
          {(loading || byModel.length > 0 || byProvider.length > 0 || byAgent.length > 0 || byChannel.length > 0) && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
              <Card>
                <CardHeader className="pb-0">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-8 w-full" />
                      ))}
                    </div>
                  ) : (
                    <Tabs defaultValue="model">
                      <TabsList className="mb-4">
                        {byModel.length > 0 && (
                          <TabsTrigger value="model">By Model</TabsTrigger>
                        )}
                        {byProvider.length > 0 && (
                          <TabsTrigger value="provider">By Provider</TabsTrigger>
                        )}
                        {byAgent.length > 0 && (
                          <TabsTrigger value="agent">By Agent</TabsTrigger>
                        )}
                        {byChannel.length > 0 && (
                          <TabsTrigger value="channel">By Channel</TabsTrigger>
                        )}
                      </TabsList>

                      {byModel.length > 0 && (
                        <TabsContent value="model">
                          <BreakdownTable data={byModel} nameLabel="Model" />
                        </TabsContent>
                      )}
                      {byProvider.length > 0 && (
                        <TabsContent value="provider">
                          <BreakdownTable data={byProvider} nameLabel="Provider" />
                        </TabsContent>
                      )}
                      {byAgent.length > 0 && (
                        <TabsContent value="agent">
                          <BreakdownTable data={byAgent} nameLabel="Agent" />
                        </TabsContent>
                      )}
                      {byChannel.length > 0 && (
                        <TabsContent value="channel">
                          <BreakdownTable data={byChannel} nameLabel="Channel" />
                        </TabsContent>
                      )}

                      {byModel.length === 0 &&
                        byProvider.length === 0 &&
                        byAgent.length === 0 &&
                        byChannel.length === 0 && (
                          <p className="text-muted-foreground text-sm py-4">
                            No breakdown data available
                          </p>
                        )}
                    </Tabs>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Session Usage List */}
          {(loading || (sessionsUsage?.sessions && sessionsUsage.sessions.length > 0)) && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
              <Card>
                <CardHeader className="pb-0">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Coins className="w-4 h-4" />
                    Top Sessions by Cost
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : (
                    <SessionUsageList sessions={sessionsUsage!.sessions} />
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Empty state */}
          {!loading && !usageStatus && !usageCost && !sessionsUsage && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <BarChart3 className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-sm">No usage data returned.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Sub Components ──────────────────────────────────────────────────────────

function KPICard({
  title,
  value,
  icon,
  loading,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <AnimatedValue value={value} />
        )}
      </CardContent>
    </Card>
  );
}

function ProviderCard({ provider }: { provider: ProviderUsage }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>{provider.displayName || provider.provider}</span>
          {provider.plan && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {provider.plan}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {provider.error ? (
          <p className="text-sm text-destructive">{provider.error}</p>
        ) : provider.windows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rate limit data</p>
        ) : (
          provider.windows.map((w, i) => {
            const pct = Math.min(100, Math.max(0, w.usedPercent));
            const barColor =
              pct > 90
                ? "bg-red-500"
                : pct > 70
                  ? "bg-amber-500"
                  : "bg-emerald-500";
            return (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">
                    {w.label}
                  </span>
                  <span className="text-xs font-mono">
                    {pct.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className={`h-full rounded-full ${barColor}`}
                  />
                </div>
                {w.resetAt && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Resets {formatTimeAgo(w.resetAt)}
                  </p>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function BreakdownTable({
  data,
  nameLabel,
}: {
  data: AggregateEntry[];
  nameLabel: string;
}) {
  const sorted = useMemo(
    () => [...data].sort((a, b) => (b.totalCost ?? 0) - (a.totalCost ?? 0)),
    [data]
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="text-left py-2 font-medium">{nameLabel}</th>
            <th className="text-right py-2 font-medium">Tokens</th>
            <th className="text-right py-2 font-medium">Cost</th>
            <th className="text-right py-2 font-medium">Count</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={row.name || row.key || i}
              className="border-b border-border/50 last:border-0"
            >
              <td className="py-2 font-mono text-xs">
                {row.name || row.key || "--"}
              </td>
              <td className="py-2 text-right font-mono text-xs">
                {formatCompactNumber(row.totalTokens ?? 0)}
              </td>
              <td className="py-2 text-right font-mono text-xs">
                ${(row.totalCost ?? 0).toFixed(4)}
              </td>
              <td className="py-2 text-right font-mono text-xs">
                {row.count ?? row.sessions ?? "--"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SessionUsageList({ sessions }: { sessions: SessionUsageEntry[] }) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...sessions].sort(
        (a, b) => (b.usage?.totalCost ?? 0) - (a.usage?.totalCost ?? 0)
      ),
    [sessions]
  );

  if (sorted.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No session usage data</p>
    );
  }

  return (
    <div className="divide-y divide-border">
      {sorted.map((session) => {
        const isExpanded = expandedKey === session.key;
        return (
          <div key={session.key}>
            <div
              className="flex items-center justify-between py-2.5 cursor-pointer hover:bg-accent/30 -mx-2 px-2 rounded transition-colors"
              onClick={() =>
                setExpandedKey(isExpanded ? null : session.key)
              }
            >
              <div className="flex items-center gap-3 min-w-0">
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                )}
                <span className="text-sm truncate">
                  {session.label || session.key}
                </span>
                {session.channel && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 shrink-0"
                  >
                    {session.channel}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 shrink-0 text-xs text-muted-foreground">
                <span className="font-mono">
                  {formatCompactNumber(session.usage?.totalTokens ?? 0)}
                </span>
                <span className="font-mono font-medium text-foreground">
                  ${(session.usage?.totalCost ?? 0).toFixed(4)}
                </span>
              </div>
            </div>
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pl-8 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    {session.agentId && (
                      <div>
                        <span className="text-muted-foreground">Agent:</span>{" "}
                        <span className="font-mono">{session.agentId}</span>
                      </div>
                    )}
                    {session.model && (
                      <div>
                        <span className="text-muted-foreground">Model:</span>{" "}
                        <span className="font-mono">{session.model}</span>
                      </div>
                    )}
                    {session.usage?.input != null && (
                      <div>
                        <span className="text-muted-foreground">Input:</span>{" "}
                        <span className="font-mono">
                          {formatCompactNumber(session.usage.input)}
                        </span>
                      </div>
                    )}
                    {session.usage?.output != null && (
                      <div>
                        <span className="text-muted-foreground">Output:</span>{" "}
                        <span className="font-mono">
                          {formatCompactNumber(session.usage.output)}
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatCompactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatShortDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatTimeAgo(ts: number): string {
  const now = Date.now();
  const diffMs = now - ts;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffDay > 0) return `${diffDay}d ago`;
  if (diffHr > 0) return `${diffHr}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  if (diffSec < 0) {
    const absSec = Math.abs(diffSec);
    const absMin = Math.floor(absSec / 60);
    const absHr = Math.floor(absMin / 60);
    if (absHr > 0) return `in ${absHr}h`;
    if (absMin > 0) return `in ${absMin}m`;
    return "in a moment";
  }
  return "just now";
}
