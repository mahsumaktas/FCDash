"use client";

import { useEffect, useCallback } from "react";
import { useEvent } from "@/hooks/use-event";
import { useKanbanStore } from "@/stores/kanban";
import { KanbanBoard } from "@/components/ops/kanban-board";
import { QuickAddDialog } from "@/components/ops/quick-add-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { useState } from "react";

export default function OpsPage() {
  const { tasks, loaded, loadFromStorage, moveTask } = useKanbanStore();
  const [dialogOpen, setDialogOpen] = useState(false);

  // Load tasks from localStorage on mount
  useEffect(() => {
    if (!loaded) loadFromStorage();
  }, [loaded, loadFromStorage]);

  // Keyboard shortcut: Cmd+Shift+N to open dialog
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "N") {
        e.preventDefault();
        setDialogOpen(true);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Gateway event: auto-move linked tasks to "review" when session completes
  const handleSessionComplete = useCallback(
    (event: { sessionKey?: string }) => {
      if (!event.sessionKey) return;
      const linkedTasks = tasks.filter(
        (t) =>
          t.linkedSessionKey === event.sessionKey &&
          t.column !== "done" &&
          t.column !== "review"
      );
      for (const task of linkedTasks) {
        moveTask(task.id, "review", 0);
      }
    },
    [tasks, moveTask]
  );

  useEvent("chat.completed" as never, handleSessionComplete);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Operations Board</h1>
          <Badge variant="secondary" className="text-xs">
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
          </Badge>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4" />
          New Task
        </Button>
      </div>

      {/* Board */}
      <KanbanBoard />

      {/* Quick Add Dialog */}
      <QuickAddDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
