// lifeboard/components/tasks/TaskList.tsx
"use client";

import type { Task } from "@/types/tasks";
import { TaskRow } from "./TaskRow";

interface TaskListProps {
  tasks: Task[];
  onToggleComplete: (id: string) => void;
  onRetrySchedule: (id: string) => void;
  onConflictEdit: (id: string, newRawText: string) => void;
  onPickSlot: (id: string, slot: { start: string; end: string }) => void;
}

export function TaskList({
  tasks,
  onToggleComplete,
  onRetrySchedule,
  onConflictEdit,
  onPickSlot,
}: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <p className="mt-4 text-center text-xs text-slate-500">
        No tasks yet. Start by adding something below. <br />
        E.g., &quot;Buy groceries tomorrow at 5pm&quot;
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          onToggleComplete={() => onToggleComplete(task.id)}
          onRetrySchedule={
            task.status === "failed"
              ? () => onRetrySchedule(task.id)
              : undefined
          }
          onConflictEdit={
            task.status === "conflict"
              ? (newText) => onConflictEdit(task.id, newText)
              : undefined
          }
          onPickSlot={
            task.status === "conflict"
              ? (slot) => onPickSlot(task.id, slot)
              : undefined
          }
        />
      ))}
    </div>
  );
}
