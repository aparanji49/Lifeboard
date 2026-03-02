import type { Task, TaskStatus } from "@/types/tasks";
import type { Task as PrismaTask, SchedulingStatus } from "@prisma/client";

const schedulingToStatus: Record<SchedulingStatus, TaskStatus> = {
  NEW: "unscheduled",
  PROCESSING: "unscheduled",
  PROPOSED: "conflict",
  SCHEDULED: "scheduled",
  RETRY: "failed",
  ERROR: "failed",
};

export function prismaTaskToClient(row: PrismaTask): Task {
  const status: TaskStatus = row.isCompleted
    ? "completed"
    : schedulingToStatus[row.schedulingStatus];

  return {
    id: row.id,
    serverId: row.id,
    rawText: row.userInstruction ?? row.title,
    title: row.title,
    description: row.description ?? undefined,
    status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    scheduledStart: row.startTime?.toISOString(),
    scheduledEnd: row.endTime?.toISOString(),
    calendarEventId: row.googleEventId ?? undefined,
    errorMessage: row.errorMessage ?? undefined,
    syncStatus: "synced",
  };
}

export function clientTaskToPrismaPayload(task: Task) {
  const schedulingStatus: SchedulingStatus =
    task.status === "completed"
      ? "SCHEDULED"
      : task.status === "scheduled"
        ? "SCHEDULED"
        : task.status === "conflict"
          ? "PROPOSED"
          : task.status === "failed"
            ? "ERROR"
            : "NEW";

  return {
    title: task.title,
    description: task.description ?? null,
    userInstruction: task.rawText,
    schedulingStatus,
    isCompleted: task.status === "completed",
    startTime: task.scheduledStart ? new Date(task.scheduledStart) : null,
    endTime: task.scheduledEnd ? new Date(task.scheduledEnd) : null,
    googleEventId: task.calendarEventId ?? null,
    errorMessage: task.errorMessage ?? null,
  };
}
