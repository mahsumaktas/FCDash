"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MarkdownMessage } from "@/components/chat/markdown-message";
import {
  type KanbanTask,
  type TaskCreator,
  PRIORITY_COLORS,
  TAG_COLORS,
  TAG_LABELS,
  useKanbanStore,
} from "@/stores/kanban";
import {
  Flag,
  Bot,
  User,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Square,
  CheckSquare,
  Clock,
  Play,
  StopCircle,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";

interface TicketDrawerProps {
  task: KanbanTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Duration formatter ──────────────────────────────────────────────────────

function formatDuration(startMs: number, endMs?: number): string {
  const diff = (endMs ?? Date.now()) - startMs;
  const totalMins = Math.floor(diff / 60_000);
  if (totalMins < 1) return "< 1m";
  if (totalMins < 60) return `${totalMins}m`;
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs < 24) return `${hrs}h ${mins}m`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
}

// ─── WorkLogItem ─────────────────────────────────────────────────────────────

function WorkLogItem({
  actor,
  message,
  timestamp,
  durationMin,
}: {
  actor: string;
  message: string;
  timestamp: number;
  durationMin?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = message.length > 120;
  const preview = isLong ? message.slice(0, 120) + "..." : message;

  return (
    <div className="rounded-md bg-zinc-950 border border-zinc-800 p-3 font-mono text-xs">
      <div className="flex items-center gap-2 text-zinc-500 mb-1">
        <span className="font-semibold text-zinc-400">{actor}</span>
        <span className="text-[10px]">
          {new Date(timestamp).toLocaleTimeString()}
        </span>
        {durationMin != null && (
          <span className="inline-flex items-center gap-1 text-[10px] text-orange-400">
            <Timer className="w-2.5 h-2.5" />
            {durationMin}m
          </span>
        )}
        {isLong && (
          <button
            className="ml-auto text-zinc-500 hover:text-zinc-300 transition-colors"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>
        )}
      </div>
      <p className="text-zinc-300 whitespace-pre-wrap leading-relaxed">
        {expanded || !isLong ? message : preview}
      </p>
    </div>
  );
}

// ─── Time Tracking Section ──────────────────────────────────────────────────

function TimeTrackingSection({ task }: { task: KanbanTask }) {
  const { startTimer, stopTimer } = useKanbanStore();
  const isRunning = task.startedAt != null && task.completedAt == null;
  const isCompleted = task.startedAt != null && task.completedAt != null;

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium inline-flex items-center gap-1.5">
          <Clock className="w-4 h-4" />
          Time Tracking
        </h4>
        {!isRunning && !isCompleted && (
          <Button size="sm" variant="outline" onClick={() => startTimer(task.id)}>
            <Play className="w-3 h-3" />
            Start
          </Button>
        )}
        {isRunning && (
          <Button size="sm" variant="outline" onClick={() => stopTimer(task.id)}>
            <StopCircle className="w-3 h-3 text-red-400" />
            Stop
          </Button>
        )}
      </div>

      {task.startedAt && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Started</span>
            <p className="font-mono">{new Date(task.startedAt).toLocaleString()}</p>
          </div>
          {task.completedAt && (
            <div>
              <span className="text-muted-foreground">Completed</span>
              <p className="font-mono">{new Date(task.completedAt).toLocaleString()}</p>
            </div>
          )}
          <div className="col-span-2">
            <span className="text-muted-foreground">Duration</span>
            <p className={cn("font-mono font-semibold", isRunning && "text-orange-400")}>
              {formatDuration(task.startedAt, task.completedAt)}
              {isRunning && " (running)"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Agent Assignment ───────────────────────────────────────────────────────

function AssigneeSelector({ task }: { task: KanbanTask }) {
  const { updateTask } = useKanbanStore();
  const [open, setOpen] = useState(false);

  const agents: TaskCreator[] = [
    { kind: "human", name: "You" },
    { kind: "agent", name: "Scout" },
    { kind: "agent", name: "Analyst" },
    { kind: "agent", name: "Guardian" },
    { kind: "agent", name: "Writer" },
    { kind: "agent", name: "Hachi" },
  ];

  const handleSelect = (assignee: TaskCreator | null) => {
    updateTask(task.id, { assignee });
    setOpen(false);
  };

  return (
    <div className="space-y-1.5">
      <span className="text-xs text-muted-foreground">Assignee</span>
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors"
        >
          {task.assignee ? (
            <>
              {task.assignee.kind === "agent" ? (
                <Bot className="w-3.5 h-3.5" />
              ) : (
                <User className="w-3.5 h-3.5" />
              )}
              {task.assignee.name}
            </>
          ) : (
            <span className="text-muted-foreground">Unassigned</span>
          )}
          <ChevronDown className="w-3 h-3 ml-auto text-muted-foreground" />
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-1 z-50 w-full bg-popover border rounded-md shadow-lg p-1">
            <button
              className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-accent transition-colors text-muted-foreground"
              onClick={() => handleSelect(null)}
            >
              Unassigned
            </button>
            {agents.map((a) => (
              <button
                key={`${a.kind}-${a.name}`}
                className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-accent transition-colors flex items-center gap-2"
                onClick={() => handleSelect(a)}
              >
                {a.kind === "agent" ? (
                  <Bot className="w-3.5 h-3.5" />
                ) : (
                  <User className="w-3.5 h-3.5" />
                )}
                {a.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TicketDrawer ────────────────────────────────────────────────────────────

export function TicketDrawer({ task, open, onOpenChange }: TicketDrawerProps) {
  const { updateTask, moveTask, toggleStep } = useKanbanStore();

  if (!task) return null;

  const isReview = task.column === "review";
  const doneSteps = task.steps.filter((s) => s.done).length;
  const totalSteps = task.steps.length;

  const handleApprove = () => {
    moveTask(task.id, "done", 0);
    onOpenChange(false);
  };

  const handleReject = () => {
    updateTask(task.id, { column: "todo" });
    onOpenChange(false);
  };

  // Total logged time
  const totalLoggedMin = useMemo(
    () => task.workLog.reduce((sum, e) => sum + (e.durationMin ?? 0), 0),
    [task.workLog]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg flex flex-col overflow-hidden">
        <SheetHeader className="shrink-0">
          <div className="flex items-start gap-2">
            <Flag
              className={cn(
                "w-4 h-4 mt-1 shrink-0",
                PRIORITY_COLORS[task.priority]
              )}
            />
            <SheetTitle className="text-base leading-snug">
              {task.title}
            </SheetTitle>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {task.tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className={cn("text-[10px] px-1.5 py-0", TAG_COLORS[tag])}
              >
                {TAG_LABELS[tag]}
              </Badge>
            ))}
            <Separator orientation="vertical" className="h-3" />
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              {task.creator.kind === "agent" ? (
                <Bot className="w-3 h-3" />
              ) : (
                <User className="w-3 h-3" />
              )}
              {task.creator.name}
            </span>
            {task.assignee && (
              <>
                <span className="text-muted-foreground/40 text-xs">&rarr;</span>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  {task.assignee.kind === "agent" ? (
                    <Bot className="w-3 h-3" />
                  ) : (
                    <User className="w-3 h-3" />
                  )}
                  {task.assignee.name}
                </span>
              </>
            )}
          </div>
        </SheetHeader>

        {/* Tabs */}
        <Tabs defaultValue="details" className="flex-1 min-h-0 flex flex-col px-4">
          <TabsList className="w-full shrink-0">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="logs">
              Logs
              {task.workLog.length > 0 && (
                <span className="ml-1 text-[10px] text-muted-foreground">
                  ({task.workLog.length})
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="result">Result</TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent
            value="details"
            className="flex-1 overflow-y-auto space-y-4 pb-4"
          >
            {/* Description */}
            {task.description && (
              <div className="mt-2">
                <MarkdownMessage content={task.description} />
              </div>
            )}

            {/* Time tracking */}
            <TimeTrackingSection task={task} />

            {/* Agent assignment */}
            <AssigneeSelector task={task} />

            {/* Steps checklist */}
            {totalSteps > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Steps</h4>
                  <span className="text-xs text-muted-foreground">
                    {doneSteps}/{totalSteps}
                  </span>
                </div>
                <div className="space-y-1">
                  {task.steps.map((step) => (
                    <button
                      key={step.id}
                      className="flex items-center gap-2 w-full text-left rounded-md px-2 py-1.5 text-sm hover:bg-muted/50 transition-colors"
                      onClick={() => toggleStep(task.id, step.id)}
                    >
                      {step.done ? (
                        <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                      <span
                        className={cn(
                          step.done && "line-through text-muted-foreground"
                        )}
                      >
                        {step.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!task.description && totalSteps === 0 && (
              <p className="text-sm text-muted-foreground italic py-4 text-center">
                No description or steps added.
              </p>
            )}
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent
            value="logs"
            className="flex-1 overflow-y-auto space-y-2 pb-4"
          >
            {/* Summary */}
            {totalLoggedMin > 0 && (
              <div className="rounded-md bg-muted/50 p-2 text-xs flex items-center gap-2">
                <Timer className="w-3.5 h-3.5 text-muted-foreground" />
                <span>
                  Total logged: <strong>{totalLoggedMin}m</strong>
                  {totalLoggedMin >= 60 && (
                    <span className="text-muted-foreground ml-1">
                      ({Math.floor(totalLoggedMin / 60)}h {totalLoggedMin % 60}m)
                    </span>
                  )}
                </span>
              </div>
            )}

            {task.workLog.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-4 text-center">
                No work logs yet.
              </p>
            ) : (
              task.workLog.map((entry) => (
                <WorkLogItem
                  key={entry.id}
                  actor={entry.actor}
                  message={entry.message}
                  timestamp={entry.timestamp}
                  durationMin={entry.durationMin}
                />
              ))
            )}
          </TabsContent>

          {/* Result Tab */}
          <TabsContent
            value="result"
            className="flex-1 overflow-y-auto pb-4"
          >
            {task.result ? (
              <div className="mt-2">
                <MarkdownMessage content={task.result} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic py-4 text-center">
                No result yet.
              </p>
            )}
          </TabsContent>
        </Tabs>

        {/* Footer — only in review */}
        {isReview && (
          <SheetFooter className="shrink-0 flex-row gap-2 border-t pt-4">
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleApprove}
            >
              <Check className="w-4 h-4" />
              Approve
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleReject}
            >
              <X className="w-4 h-4" />
              Reject
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
