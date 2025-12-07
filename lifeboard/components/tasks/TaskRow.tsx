// lifeboard/components/tasks/TaskRow.tsx
"use client";

import { Task } from "@/types/tasks";
import { TaskStatusPill } from "./TaskStatusPill";
import { Pencil, Trash2 } from "lucide-react";

interface TaskRowProps {
  task: Task;
  onToggleComplete: () => void;
  onEditTitle: (newText: string) => void;
  onRetrySchedule?: () => void;
  onConflictEdit?: (newRawText: string) => void;
  onDelete: () => void;
}

export function TaskRow({
  task,
  onToggleComplete,
  onEditTitle,
  onRetrySchedule,
  onConflictEdit,
  onDelete,
}: TaskRowProps) {
  const completed = task.status === "completed";

  const handleInlineEdit = () => {
    const updated = prompt("Edit task", task.title);
    if (updated && updated.trim()) onEditTitle(updated.trim());
  };

  const handleConflictEdit = () => {
    if (!onConflictEdit) return;
    const updated = prompt(
      "Update this task before scheduling",
      (task as any).rawText ?? task.title
    );
    if (updated && updated.trim()) onConflictEdit(updated.trim());
  };

  return (
    <div className="flex items-center gap-4 py-1">
      {/* left bullet */}
      <button
        type="button"
        onClick={onToggleComplete}
        className={`flex h-5 w-5 items-center justify-center rounded-full border border-slate-400 bg-white ${
          completed ? "bg-slate-200" : ""
        }`}
      >
        {completed && <span className="h-3 w-3 rounded-full bg-slate-500" />}
      </button>

      {/* task title */}
      <div className="flex-1 border-b border-slate-300/80 pb-1 text-sm text-slate-900">
        {completed ? (
          <span className="line-through opacity-70">{task.title}</span>
        ) : (
          <span>{task.title}</span>
        )}

        {/* warning messages */}
        {task.status === "conflict" && task.conflictMessage && (
          <div className="mt-1 text-[11px] text-amber-700">
            {task.conflictMessage}
          </div>
        )}
        {task.status === "failed" && task.errorMessage && (
          <div className="mt-1 text-[11px] text-rose-700">
            {task.errorMessage}
          </div>
        )}
      </div>

      {/* conflict or error actions */}
      {task.status === "conflict" && onConflictEdit && (
        <button
          type="button"
          onClick={handleConflictEdit}
          className="text-xs font-medium text-amber-700 hover:underline"
        >
          Edit
        </button>
      )}

      {task.status === "failed" && onRetrySchedule && (
        <button
          type="button"
          onClick={onRetrySchedule}
          className="text-xs font-medium text-rose-700 hover:underline"
        >
          Retry
        </button>
      )}

      {/* pencil edit */}
      <button
        type="button"
        className="mr-1 text-slate-500 hover:text-slate-800"
        onClick={handleInlineEdit}
      >
        <Pencil size={16} />
      </button>

      {/* delete button */}
      <button
        type="button"
        onClick={onDelete}
        className="mr-1 text-slate-400 hover:text-red-600"
      >
        <Trash2 size={16} />
      </button>

      <TaskStatusPill status={task.status} />
    </div>
  );
}
