"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Flag, GripVertical, Bot, User, Clock, Square, CheckSquare2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  type KanbanTask,
  PRIORITY_COLORS,
  TAG_COLORS,
  TAG_LABELS,
  useKanbanStore,
} from "@/stores/kanban";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

interface KanbanCardProps {
  task: KanbanTask;
  onClick?: () => void;
  isOverlay?: boolean;
}

function formatElapsed(startMs: number): string {
  const diff = Date.now() - startMs;
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m`;
}

export function KanbanCard({ task, onClick, isOverlay }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const { toggleSelect, selectedIds } = useKanbanStore();
  const isSelected = selectedIds.has(task.id);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isInProgress = task.column === "in-progress";
  const doneSteps = task.steps.filter((s) => s.done).length;
  const totalSteps = task.steps.length;
  const progressPct = totalSteps > 0 ? (doneSteps / totalSteps) * 100 : 0;

  const elapsed = useMemo(() => {
    if (task.startedAt && !task.completedAt) return formatElapsed(task.startedAt);
    if (task.startedAt && task.completedAt) {
      const diff = task.completedAt - task.startedAt;
      const mins = Math.floor(diff / 60_000);
      if (mins < 60) return `${mins}m`;
      const hrs = Math.floor(mins / 60);
      return `${hrs}h ${mins % 60}m`;
    }
    return null;
  }, [task.startedAt, task.completedAt]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-lg border bg-card p-3 text-card-foreground shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5",
        isDragging && "opacity-40",
        isOverlay && "rotate-2 scale-105 shadow-xl",
        isSelected && "ring-2 ring-primary/60 bg-primary/5",
        isInProgress &&
          "ring-1 ring-orange-500/40 shadow-[0_0_12px_rgba(249,115,22,0.15)]"
      )}
      onClick={onClick}
    >
      {/* Selection checkbox */}
      <button
        className={cn(
          "absolute right-1.5 top-1.5 p-0.5 rounded transition-all",
          isSelected
            ? "opacity-100 text-primary"
            : "opacity-0 group-hover:opacity-60 hover:!opacity-100 text-muted-foreground"
        )}
        onClick={(e) => {
          e.stopPropagation();
          toggleSelect(task.id);
        }}
        aria-label={isSelected ? "Deselect" : "Select"}
      >
        {isSelected ? (
          <CheckSquare2 className="w-4 h-4" />
        ) : (
          <Square className="w-4 h-4" />
        )}
      </button>

      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-0.5"
        aria-label="Drag task"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
      </button>

      <div className="pl-3 space-y-2">
        {/* Priority + Title */}
        <div className="flex items-start gap-1.5 pr-5">
          <Flag
            className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", PRIORITY_COLORS[task.priority])}
          />
          <p className="text-sm font-medium leading-snug line-clamp-2">
            {task.title}
          </p>
        </div>

        {/* Tags */}
        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className={cn("text-[10px] px-1.5 py-0", TAG_COLORS[tag])}
              >
                {TAG_LABELS[tag]}
              </Badge>
            ))}
          </div>
        )}

        {/* Creator / Assignee + Time tracking row */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            {task.creator.kind === "agent" ? (
              <Bot className="w-3 h-3" />
            ) : (
              <User className="w-3 h-3" />
            )}
            {task.creator.name}
          </span>
          {task.assignee && (
            <>
              <span className="text-muted-foreground/40">&rarr;</span>
              <span className="inline-flex items-center gap-1">
                {task.assignee.kind === "agent" ? (
                  <Bot className="w-3 h-3" />
                ) : (
                  <User className="w-3 h-3" />
                )}
                {task.assignee.name}
              </span>
            </>
          )}
          {elapsed && (
            <span className="ml-auto inline-flex items-center gap-1 text-[10px]">
              <Clock className={cn("w-3 h-3", !task.completedAt && "text-orange-400")} />
              {elapsed}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {totalSteps > 0 && (
          <div className="space-y-1">
            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              {doneSteps}/{totalSteps} steps
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
