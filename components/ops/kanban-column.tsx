"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { KanbanColumnId, KanbanTask } from "@/stores/kanban";
import { KANBAN_COLUMNS, useKanbanStore } from "@/stores/kanban";
import { KanbanCard } from "./kanban-card";
import { cn } from "@/lib/utils";
import { CheckSquare } from "lucide-react";

interface KanbanColumnProps {
  columnId: KanbanColumnId;
  tasks: KanbanTask[];
  onCardClick: (task: KanbanTask) => void;
}

export function KanbanColumn({ columnId, tasks, onCardClick }: KanbanColumnProps) {
  const column = KANBAN_COLUMNS.find((c) => c.id === columnId)!;
  const { setNodeRef, isOver } = useDroppable({ id: columnId });
  const taskIds = tasks.map((t) => t.id);
  const { selectAll, selectedIds } = useKanbanStore();

  const selectedInColumn = tasks.filter((t) => selectedIds.has(t.id)).length;

  return (
    <div className="w-[300px] shrink-0 flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center gap-2 px-2 py-1.5">
        <span className="relative flex h-2.5 w-2.5">
          <span
            className={cn(
              "absolute inline-flex h-full w-full rounded-full opacity-75",
              column.color,
              columnId === "in-progress" && "animate-ping"
            )}
          />
          <span
            className={cn(
              "relative inline-flex h-2.5 w-2.5 rounded-full",
              column.color
            )}
          />
        </span>
        <h3 className="text-sm font-semibold">{column.title}</h3>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {tasks.length}
        </span>
        {/* Select all button */}
        {tasks.length > 0 && (
          <button
            onClick={() => selectAll(columnId)}
            className={cn(
              "p-0.5 rounded transition-colors",
              selectedInColumn > 0
                ? "text-primary"
                : "text-muted-foreground/40 hover:text-muted-foreground"
            )}
            title={`Select all in ${column.title}`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Body */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 rounded-xl bg-card/50 backdrop-blur-sm p-2 space-y-2 min-h-[120px] transition-colors",
          isOver && "border border-primary/50 bg-primary/5",
          !isOver && "border border-transparent"
        )}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <div className="flex items-center justify-center h-full min-h-[80px] rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground">
              {isOver ? "Drop here" : "No tasks yet"}
            </div>
          ) : (
            tasks.map((task) => (
              <KanbanCard
                key={task.id}
                task={task}
                onClick={() => onCardClick(task)}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}
