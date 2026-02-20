import { create } from "zustand";

export interface ApprovalNotification {
  id: string;
  command?: string;
  agentId?: string;
  sessionKey?: string;
  timestamp: number;
}

interface NotificationStore {
  pendingApprovals: ApprovalNotification[];
  addApproval: (a: ApprovalNotification) => void;
  removeApproval: (id: string) => void;
  clearApprovals: () => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  pendingApprovals: [],
  addApproval: (a) => set((s) => ({ pendingApprovals: [...s.pendingApprovals, a] })),
  removeApproval: (id) => set((s) => ({ pendingApprovals: s.pendingApprovals.filter((p) => p.id !== id) })),
  clearApprovals: () => set({ pendingApprovals: [] }),
}));
