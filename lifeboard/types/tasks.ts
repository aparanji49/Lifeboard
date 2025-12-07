export type TaskStatus =
  | "unscheduled"
  | "scheduled"
  | "conflict"
  | "failed"
  | "completed";

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
}
