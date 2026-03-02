export type TaskStatus =
  | "unscheduled"
  | "scheduled"
  | "conflict"
  | "failed"
  | "completed";

export type SyncStatus = "local" | "synced" | "pending";

export interface Task {
  id: string;
  rawText: string;           // what user typed
  title: string;
  description?: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  calendarEventId?: string;
  conflictMessage?: string;
  errorMessage?: string;
  /** Server task id (Prisma) after sync */
  serverId?: string;
  /** For reconciliation with PostgreSQL */
  syncStatus?: SyncStatus;
}

export type PendingOpType = "create" | "update" | "delete";

export interface PendingOp {
  id: string;
  type: PendingOpType;
  localId: string;
  serverId?: string;
  payload: Partial<Task> | null;
  createdAt: string;
}
