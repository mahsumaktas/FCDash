"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  type KanbanColumnId,
  type TaskPriority,
  type TaskTag,
  type KanbanTask,
  TAG_LABELS,
  TAG_COLORS,
  useKanbanStore,
} from "@/stores/kanban";
import { cn } from "@/lib/utils";

interface QuickAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const COLUMN_OPTIONS: { id: KanbanColumnId; label: string }[] = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "To Do" },
];

const PRIORITY_OPTIONS: { id: TaskPriority; label: string }[] = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "critical", label: "Critical" },
];

const ALL_TAGS: TaskTag[] = [
  "bug",
  "feature",
  "infra",
  "security",
  "ux",
  "docs",
  "perf",
];

export function QuickAddDialog({ open, onOpenChange }: QuickAddDialogProps) {
  const addTask = useKanbanStore((s) => s.addTask);
  const tasks = useKanbanStore((s) => s.tasks);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [column, setColumn] = useState<KanbanColumnId>("backlog");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [selectedTags, setSelectedTags] = useState<TaskTag[]>([]);

  const reset = useCallback(() => {
    setTitle("");
    setDescription("");
    setColumn("backlog");
    setPriority("medium");
    setSelectedTags([]);
  }, []);

  const handleCreate = useCallback(() => {
    if (!title.trim()) return;

    const columnTasks = tasks.filter((t) => t.column === column);
    const maxOrder = columnTasks.reduce(
      (max, t) => Math.max(max, t.order),
      -1
    );

    const task: KanbanTask = {
      id: crypto.randomUUID(),
      title: title.trim(),
      description: description.trim(),
      column,
      order: maxOrder + 1,
      priority,
      tags: selectedTags,
      creator: { kind: "human", name: "You" },
      assignee: null,
      steps: [],
      workLog: [],
      result: "",
      linkedSessionKey: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      startedAt: undefined,
      completedAt: undefined,
    };

    addTask(task);
    reset();
    onOpenChange(false);
  }, [title, description, column, priority, selectedTags, tasks, addTask, reset, onOpenChange]);

  const toggleTag = (tag: TaskTag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && title.trim()) {
      e.preventDefault();
      handleCreate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              placeholder="What needs to be done?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="task-desc">
              Description{" "}
              <span className="text-muted-foreground font-normal">(optional, Markdown)</span>
            </Label>
            <Textarea
              id="task-desc"
              placeholder="Add details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-20"
            />
          </div>

          {/* Column */}
          <div className="space-y-1.5">
            <Label>Column</Label>
            <div className="flex gap-2">
              {COLUMN_OPTIONS.map((opt) => (
                <Button
                  key={opt.id}
                  variant={column === opt.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setColumn(opt.id)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <div className="flex gap-2 flex-wrap">
              {PRIORITY_OPTIONS.map((opt) => (
                <Button
                  key={opt.id}
                  variant={priority === opt.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPriority(opt.id)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_TAGS.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <Badge
                    key={tag}
                    variant="outline"
                    className={cn(
                      "cursor-pointer select-none text-xs transition-colors",
                      active
                        ? TAG_COLORS[tag]
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => toggleTag(tag)}
                  >
                    {TAG_LABELS[tag]}
                  </Badge>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!title.trim()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
