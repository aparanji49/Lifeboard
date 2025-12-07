// lifeboard/components/tasks/TaskList.tsx
"use client";

import type { Task } from "@/types/tasks";
import { TaskRow } from "./TaskRow";

interface TaskListProps {
  tasks: Task[];
  onToggleComplete: (id: string) => void;
  onEditTitle: (id: string, text: string) => void;
  onRetrySchedule: (id: string) => void;
  onConflictEdit: (id: string, newRawText: string) => void;
  onDeleteTask: (id: string) => void;
}

export function TaskList({
  tasks,
  onToggleComplete,
  onEditTitle,
  onRetrySchedule,
  onConflictEdit,
  onDeleteTask,
}: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <p className="mt-4 text-center text-xs text-slate-500">
        No tasks yet. Start by adding something below.
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
          onEditTitle={(txt) => onEditTitle(task.id, txt)}
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
          onDelete={() => onDeleteTask(task.id)}
        />
      ))}
    </div>
  );
}
