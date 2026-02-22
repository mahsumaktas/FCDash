import { create } from "zustand";

// ─── Column IDs ──────────────────────────────────────────────────────────────

export type KanbanColumnId =
  | "backlog"
  | "todo"
  | "in-progress"
  | "review"
  | "done";

export const KANBAN_COLUMNS: {
  id: KanbanColumnId;
  title: string;
  color: string;
}[] = [
  { id: "backlog", title: "Backlog", color: "bg-zinc-400" },
  { id: "todo", title: "To Do", color: "bg-blue-400" },
  { id: "in-progress", title: "In Progress", color: "bg-orange-400" },
  { id: "review", title: "Review", color: "bg-purple-400" },
  { id: "done", title: "Done", color: "bg-emerald-400" },
];

// ─── Priority ────────────────────────────────────────────────────────────────

export type TaskPriority = "low" | "medium" | "high" | "critical";

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "text-zinc-400",
  medium: "text-blue-400",
  high: "text-orange-400",
  critical: "text-red-500",
};

// ─── Tags ────────────────────────────────────────────────────────────────────

export type TaskTag =
  | "bug"
  | "feature"
  | "infra"
  | "security"
  | "ux"
  | "docs"
  | "perf";

export const TAG_LABELS: Record<TaskTag, string> = {
  bug: "Bug",
  feature: "Feature",
  infra: "Infra",
  security: "Security",
  ux: "UX",
  docs: "Docs",
  perf: "Perf",
};

export const TAG_COLORS: Record<TaskTag, string> = {
  bug: "border-red-500/40 text-red-400 bg-red-500/10",
  feature: "border-blue-500/40 text-blue-400 bg-blue-500/10",
  infra: "border-zinc-500/40 text-zinc-400 bg-zinc-500/10",
  security: "border-amber-500/40 text-amber-400 bg-amber-500/10",
  ux: "border-violet-500/40 text-violet-400 bg-violet-500/10",
  docs: "border-teal-500/40 text-teal-400 bg-teal-500/10",
  perf: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10",
};

// ─── Creators / Assignees ────────────────────────────────────────────────────

export type TaskCreator = { kind: "human"; name: string } | { kind: "agent"; name: string };
export type TaskAssignee = TaskCreator;

// ─── Steps & Work Logs ──────────────────────────────────────────────────────

export interface TaskStep {
  id: string;
  label: string;
  done: boolean;
}

export interface WorkLogEntry {
  id: string;
  timestamp: number;
  actor: string;
  message: string;
  /** Duration in minutes (for time tracking) */
  durationMin?: number;
}

// ─── Task ────────────────────────────────────────────────────────────────────

export interface KanbanTask {
  id: string;
  title: string;
  description: string;
  column: KanbanColumnId;
  order: number;
  priority: TaskPriority;
  tags: TaskTag[];
  creator: TaskCreator;
  assignee: TaskAssignee | null;
  steps: TaskStep[];
  workLog: WorkLogEntry[];
  result: string;
  linkedSessionKey: string | null;
  createdAt: number;
  updatedAt: number;
  /** Time tracking: when the task was started */
  startedAt?: number;
  /** Time tracking: when the task was completed */
  completedAt?: number;
  /** Selected state for batch operations */
  selected?: boolean;
}

// ─── Persistence ────────────────────────────────────────────────────────────

const STORAGE_KEY = "fcdash-kanban-tasks";

function loadFromStorage(): KanbanTask[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* */ }
  return [];
}

function saveToStorage(tasks: KanbanTask[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch { /* */ }
}

// ─── Store ──────────────────────────────────────────────────────────────────

interface KanbanStore {
  tasks: KanbanTask[];
  loaded: boolean;
  /** Selected task IDs for batch operations */
  selectedIds: Set<string>;

  loadFromStorage: () => void;
  setTasks: (tasks: KanbanTask[]) => void;
  addTask: (task: KanbanTask) => void;
  updateTask: (id: string, patch: Partial<KanbanTask>) => void;
  deleteTask: (id: string) => void;
  moveTask: (id: string, toColumn: KanbanColumnId, order: number) => void;
  reorderTask: (id: string, newOrder: number) => void;
  addWorkLog: (taskId: string, entry: WorkLogEntry) => void;
  toggleStep: (taskId: string, stepId: string) => void;
  /** Batch operations */
  toggleSelect: (id: string) => void;
  selectAll: (column: KanbanColumnId) => void;
  clearSelection: () => void;
  batchMove: (toColumn: KanbanColumnId) => void;
  batchDelete: () => void;
  /** Time tracking */
  startTimer: (id: string) => void;
  stopTimer: (id: string) => void;
}

function persist(tasks: KanbanTask[]) {
  saveToStorage(tasks);
  return tasks;
}

export const useKanbanStore = create<KanbanStore>((set, get) => ({
  tasks: [],
  loaded: false,
  selectedIds: new Set(),

  loadFromStorage: () => {
    const tasks = loadFromStorage();
    set({ tasks, loaded: true });
  },

  setTasks: (tasks) => set({ tasks: persist(tasks) }),

  addTask: (task) =>
    set((s) => {
      const tasks = [...s.tasks, task];
      return { tasks: persist(tasks) };
    }),

  updateTask: (id, patch) =>
    set((s) => {
      const tasks = s.tasks.map((t) =>
        t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t
      );
      return { tasks: persist(tasks) };
    }),

  deleteTask: (id) =>
    set((s) => {
      const tasks = s.tasks.filter((t) => t.id !== id);
      const selectedIds = new Set(s.selectedIds);
      selectedIds.delete(id);
      return { tasks: persist(tasks), selectedIds };
    }),

  moveTask: (id, toColumn, order) =>
    set((s) => {
      const now = Date.now();
      const tasks = s.tasks.map((t) => {
        if (t.id !== id) return t;
        const patch: Partial<KanbanTask> = { column: toColumn, order, updatedAt: now };
        // Auto time tracking
        if (toColumn === "in-progress" && !t.startedAt) {
          patch.startedAt = now;
        }
        if (toColumn === "done" && !t.completedAt) {
          patch.completedAt = now;
        }
        return { ...t, ...patch };
      });
      return { tasks: persist(tasks) };
    }),

  reorderTask: (id, newOrder) =>
    set((s) => {
      const tasks = s.tasks.map((t) =>
        t.id === id ? { ...t, order: newOrder, updatedAt: Date.now() } : t
      );
      return { tasks: persist(tasks) };
    }),

  addWorkLog: (taskId, entry) =>
    set((s) => {
      const tasks = s.tasks.map((t) =>
        t.id === taskId
          ? { ...t, workLog: [...t.workLog, entry], updatedAt: Date.now() }
          : t
      );
      return { tasks: persist(tasks) };
    }),

  toggleStep: (taskId, stepId) =>
    set((s) => {
      const tasks = s.tasks.map((t) => {
        if (t.id !== taskId) return t;
        const steps = t.steps.map((step) =>
          step.id === stepId ? { ...step, done: !step.done } : step
        );
        return { ...t, steps, updatedAt: Date.now() };
      });
      return { tasks: persist(tasks) };
    }),

  // ── Batch operations ──

  toggleSelect: (id) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    }),

  selectAll: (column) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      for (const t of s.tasks) {
        if (t.column === column) next.add(t.id);
      }
      return { selectedIds: next };
    }),

  clearSelection: () => set({ selectedIds: new Set() }),

  batchMove: (toColumn) =>
    set((s) => {
      const now = Date.now();
      const maxOrder = Math.max(0, ...s.tasks.filter((t) => t.column === toColumn).map((t) => t.order));
      let order = maxOrder + 1;
      const tasks = s.tasks.map((t) => {
        if (!s.selectedIds.has(t.id)) return t;
        const patch: Partial<KanbanTask> = { column: toColumn, order: order++, updatedAt: now };
        if (toColumn === "in-progress" && !t.startedAt) patch.startedAt = now;
        if (toColumn === "done" && !t.completedAt) patch.completedAt = now;
        return { ...t, ...patch };
      });
      return { tasks: persist(tasks), selectedIds: new Set() };
    }),

  batchDelete: () =>
    set((s) => {
      const tasks = s.tasks.filter((t) => !s.selectedIds.has(t.id));
      return { tasks: persist(tasks), selectedIds: new Set() };
    }),

  // ── Time tracking ──

  startTimer: (id) =>
    set((s) => {
      const tasks = s.tasks.map((t) =>
        t.id === id ? { ...t, startedAt: Date.now(), updatedAt: Date.now() } : t
      );
      return { tasks: persist(tasks) };
    }),

  stopTimer: (id) =>
    set((s) => {
      const tasks = s.tasks.map((t) =>
        t.id === id ? { ...t, completedAt: Date.now(), updatedAt: Date.now() } : t
      );
      return { tasks: persist(tasks) };
    }),
}));
