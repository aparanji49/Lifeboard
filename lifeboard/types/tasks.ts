export type TaskStatus =
  | "unscheduled"
  | "scheduled"
  | "conflict"
  | "failed"
  | "completed";

export type SyncStatus = "local" | "synced" | "pending";

export interface TaskProgressEntry {
  ts: string; // ISO time
  message: string;
}

export interface AvailabilitySlot {
  start: string; // ISO
  end: string; // ISO
}

export interface Task {
  id: string;
  /** NextAuth user id (partition key for local IndexedDB) */
  ownerId?: string;
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
  /** Ephemeral progress log for UI/debug */
  progress?: TaskProgressEntry[];
  /** For conflict resolution UX (top suggestions) */
  suggestions?: AvailabilitySlot[];
}

export type PendingOpType = "schedule" | "create" | "update" | "delete";

export interface PendingOp {
  id: string;
  /** NextAuth user id (partition key for local IndexedDB) */
  ownerId?: string;
  type: PendingOpType;
  localId: string;
  serverId?: string;
  payload: Partial<Task> | null;
  createdAt: string;
}
