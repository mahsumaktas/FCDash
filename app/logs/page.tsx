"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useApiQuery } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ScrollText,
  Search,
  Pause,
  Play,
  Download,
  Trash2,
  WifiOff,
  ArrowDown,
} from "lucide-react";

type LogLevel = "ERROR" | "WARN" | "INFO" | "DEBUG" | "ALL";

const LEVEL_COLORS: Record<string, string> = {
  ERROR: "text-red-400",
  WARN: "text-yellow-400",
  INFO: "text-blue-400",
  DEBUG: "text-gray-400",
};

function getLogLevel(line: string): string | null {
  // Common log formats: [ERROR], ERROR:, [error], etc.
  const match = line.match(/\b(ERROR|WARN|WARNING|INFO|DEBUG|TRACE)\b/i);
  return match ? match[1].toUpperCase().replace("WARNING", "WARN") : null;
}

function getLineColor(line: string): string {
  const level = getLogLevel(line);
  if (level && LEVEL_COLORS[level]) return LEVEL_COLORS[level];
  return "text-gray-300";
}

export default function LogsPage() {
  const [lines, setLines] = useState<string[]>([]);
  const [paused, setPaused] = useState(false);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<LogLevel>("ALL");
  const [autoScroll, setAutoScroll] = useState(true);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { data: logsData, loading, error, refetch } = useApiQuery({
    method: "logs.tail",
    params: { limit: 500 },
    pollInterval: paused ? 0 : 3000,
  });

  // Sync lines from API data
  useEffect(() => {
    if (logsData?.lines) {
      setLines(logsData.lines);
    }
  }, [logsData]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 30;
    setAutoScroll(isAtBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
      setAutoScroll(true);
    }
  }, []);

  // Filter lines
  const filtered = useMemo(() => {
    let result = lines;
    if (levelFilter !== "ALL") {
      result = result.filter((line) => {
        const level = getLogLevel(line);
        return level === levelFilter;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((line) => line.toLowerCase().includes(q));
    }
    return result;
  }, [lines, levelFilter, search]);

  const handleDownload = () => {
    const content = filtered.join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `openclaw-logs-${new Date().toISOString().slice(0, 19)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    setLines([]);
  };

  if (error && !lines.length && !loading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full text-muted-foreground">
        <WifiOff className="w-16 h-16 mb-4 opacity-20" />
        <h2 className="text-lg font-medium mb-1">Unable to Load Logs</h2>
        <p className="text-sm">{error.message}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={refetch}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 p-4 border-b border-border bg-background">
        <h1 className="text-lg font-bold mr-2">Logs</h1>

        {/* Level filter */}
        <Select
          value={levelFilter}
          onValueChange={(v: string) => setLevelFilter(v as LogLevel)}
        >
          <SelectTrigger className="w-[120px]" size="sm">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Levels</SelectItem>
            <SelectItem value="ERROR">Error</SelectItem>
            <SelectItem value="WARN">Warn</SelectItem>
            <SelectItem value="INFO">Info</SelectItem>
            <SelectItem value="DEBUG">Debug</SelectItem>
          </SelectContent>
        </Select>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Filter..."
            className="h-8 pl-8 w-[180px] text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1 ml-auto">
          {/* Line count */}
          <Badge variant="outline" className="text-xs font-mono">
            {filtered.length} lines
          </Badge>

          {/* Pause/Resume */}
          <Button
            variant={paused ? "default" : "outline"}
            size="sm"
            onClick={() => setPaused(!paused)}
            title={paused ? "Resume" : "Pause"}
          >
            {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </Button>

          {/* Scroll to bottom */}
          {!autoScroll && (
            <Button
              variant="outline"
              size="sm"
              onClick={scrollToBottom}
              title="Scroll to bottom"
            >
              <ArrowDown className="w-4 h-4" />
            </Button>
          )}

          {/* Download */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            title="Download logs"
            disabled={filtered.length === 0}
          >
            <Download className="w-4 h-4" />
          </Button>

          {/* Clear */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            title="Clear"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Log output */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto bg-[#0d1117] font-mono text-xs leading-5"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <ScrollText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Loading logs...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <ScrollText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>
                {lines.length === 0
                  ? "No logs available."
                  : "No logs match your filter."}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3">
            {filtered.map((line, i) => (
              <div
                key={i}
                className={`${getLineColor(line)} hover:bg-white/5 px-1 whitespace-pre-wrap break-all`}
              >
                {line}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-t border-border bg-background text-xs text-muted-foreground">
        <span>
          {paused ? "Paused" : "Live"} &middot; Polling every 3s
        </span>
        {!autoScroll && (
          <span className="text-yellow-500">Auto-scroll paused (scroll down to re-enable)</span>
        )}
      </div>
    </div>
  );
}
