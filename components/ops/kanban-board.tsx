"use client";

import { useState, useMemo, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  type KanbanColumnId,
  type KanbanTask,
  KANBAN_COLUMNS,
  useKanbanStore,
} from "@/stores/kanban";
import { KanbanColumn } from "./kanban-column";
import { KanbanCard } from "./kanban-card";
import { TicketDrawer } from "./ticket-drawer";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Trash2, X } from "lucide-react";

// ── Custom collision: pointerWithin first, rectIntersection fallback (VidClaw pattern) ──

const customCollision: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  return rectIntersection(args);
};

export function KanbanBoard() {
  const { tasks, moveTask, reorderTask, selectedIds, clearSelection, batchMove, batchDelete } =
    useKanbanStore();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [drawerTask, setDrawerTask] = useState<KanbanTask | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [batchTarget, setBatchTarget] = useState<KanbanColumnId | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Group tasks by column, sorted by order
  const grouped = useMemo(() => {
    const map: Record<KanbanColumnId, KanbanTask[]> = {
      backlog: [],
      todo: [],
      "in-progress": [],
      review: [],
      done: [],
    };
    for (const task of tasks) {
      map[task.column]?.push(task);
    }
    for (const col of Object.keys(map) as KanbanColumnId[]) {
      map[col].sort((a, b) => a.order - b.order);
    }
    return map;
  }, [tasks]);

  const activeTask = useMemo(
    () => (activeId ? tasks.find((t) => t.id === activeId) ?? null : null),
    [activeId, tasks]
  );

  const findColumn = useCallback(
    (id: string): KanbanColumnId | null => {
      if (KANBAN_COLUMNS.some((c) => c.id === id)) return id as KanbanColumnId;
      const task = tasks.find((t) => t.id === id);
      return task?.column ?? null;
    },
    [tasks]
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeColumn = findColumn(active.id as string);
    const overColumn = findColumn(over.id as string);

    if (!activeColumn || !overColumn || activeColumn === overColumn) return;

    const overTasks = grouped[overColumn];
    const newOrder =
      overTasks.length > 0 ? overTasks[overTasks.length - 1].order + 1 : 0;
    moveTask(active.id as string, overColumn, newOrder);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const activeColumn = findColumn(active.id as string);
    const overColumn = findColumn(over.id as string);

    if (!activeColumn || !overColumn) return;

    if (activeColumn === overColumn) {
      const columnTasks = grouped[activeColumn];
      const overTask = columnTasks.find((t) => t.id === over.id);
      if (overTask) {
        reorderTask(active.id as string, overTask.order);
      }
    } else {
      const overTasks = grouped[overColumn];
      const overTask = overTasks.find((t) => t.id === over.id);
      if (overTask) {
        moveTask(active.id as string, overColumn, overTask.order);
      }
    }
  };

  const handleCardClick = (task: KanbanTask) => {
    setDrawerTask(task);
    setDrawerOpen(true);
  };

  const currentDrawerTask = useMemo(() => {
    if (!drawerTask) return null;
    return tasks.find((t) => t.id === drawerTask.id) ?? null;
  }, [drawerTask, tasks]);

  const hasSelection = selectedIds.size > 0;

  const handleBatchMove = (col: KanbanColumnId) => {
    batchMove(col);
    setBatchTarget(null);
  };

  return (
    <>
      {/* Batch operations toolbar */}
      <AnimatePresence>
        {hasSelection && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="shrink-0 border-b border-border bg-muted/50 px-6 py-2 overflow-hidden"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">
                {selectedIds.size} selected
              </span>

              {/* Move to column */}
              <div className="relative">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBatchTarget(batchTarget ? null : "todo")}
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  Move to...
                </Button>
                <AnimatePresence>
                  {batchTarget !== null && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute top-full left-0 mt-1 z-50 bg-popover border rounded-md shadow-lg p-1 min-w-[140px]"
                    >
                      {KANBAN_COLUMNS.map((col) => (
                        <button
                          key={col.id}
                          className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-accent transition-colors flex items-center gap-2"
                          onClick={() => handleBatchMove(col.id)}
                        >
                          <span className={`w-2 h-2 rounded-full ${col.color}`} />
                          {col.title}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Delete */}
              <Button size="sm" variant="destructive" onClick={batchDelete}>
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className="ml-auto"
                onClick={clearSelection}
              >
                <X className="w-3.5 h-3.5" />
                Clear
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <DndContext
        sensors={sensors}
        collisionDetection={customCollision}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <ScrollArea className="flex-1">
          <div className="flex gap-4 p-4 min-w-max">
            {KANBAN_COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                columnId={col.id}
                tasks={grouped[col.id]}
                onCardClick={handleCardClick}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <DragOverlay>
          {activeTask ? (
            <KanbanCard task={activeTask} isOverlay />
          ) : null}
        </DragOverlay>
      </DndContext>

      <TicketDrawer
        task={currentDrawerTask}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </>
  );
}
