import type { TaskStatus } from "@/types/tasks";

const statusClass: Record<TaskStatus, string> = {
  unscheduled: "bg-amber-200",
  scheduled: "bg-green-200",
  failed: "bg-rose-200",
  conflict: "bg-yellow-200",
  completed: "bg-slate-200",
};

export function TaskStatusPill({ status }: { status: TaskStatus }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${statusClass[status]} text-slate-900`}
    >
      {status}
    </span>
  );
}
