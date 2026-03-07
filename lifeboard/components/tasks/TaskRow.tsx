// lifeboard/components/tasks/TaskRow.tsx
"use client";

import type { AvailabilitySlot, Task } from "@/types/tasks";
import { TaskStatusPill } from "./TaskStatusPill";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";

interface TaskRowProps {
  task: Task;
  onToggleComplete: () => void;
  onRetrySchedule?: () => void;
  onConflictEdit?: (newRawText: string) => void;
  onPickSlot?: (slot: AvailabilitySlot) => void;
}

export function TaskRow({
  task,
  onToggleComplete,
  onRetrySchedule,
  onConflictEdit,
  onPickSlot,
}: TaskRowProps) {
  const completed = task.status === "completed";
  const [showProgress, setShowProgress] = useState(false);
  const [showSlots, setShowSlots] = useState(false);
  const progressLines = useMemo(() => task.progress ?? [], [task.progress]);
  const hasProgress = progressLines.length > 0;

  const handleConflictEdit = () => {
    if (!onConflictEdit) return;
    const updated = prompt(
      "Update this task before scheduling",
      (task as any).rawText ?? task.title
    );
    if (updated && updated.trim()) onConflictEdit(updated.trim());
  };

  return (
    <div className="py-1">
      <div className="flex items-center gap-4">
        {/* left bullet */}
        <button
          type="button"
          onClick={onToggleComplete}
          className={`flex h-5 w-5 items-center justify-center rounded-full border border-slate-400 bg-white ${completed ? "bg-slate-200" : ""
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

        {/* progress dropdown */}
        {hasProgress && (
          <button
            type="button"
            onClick={() => setShowProgress((v) => !v)}
            className="text-slate-500 hover:text-slate-800"
            title="Show progress"
          >
            {showProgress ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}

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

        {task.status === "conflict" &&
          onPickSlot &&
          (task.suggestions?.length ?? 0) > 0 && (
            <button
              type="button"
              onClick={() => setShowSlots((v) => !v)}
              className="text-xs font-medium text-slate-700 hover:underline"
            >
              Pick a time
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

        <TaskStatusPill status={task.status} />
      </div>

      {hasProgress && showProgress && (
        <div className="mt-2 ml-9 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
          <div className="space-y-1">
            {progressLines.map((p, idx) => (
              <div key={`${p.ts}-${idx}`} className="flex gap-2">
                <span className="shrink-0 font-mono text-slate-500">
                  {new Date(p.ts).toLocaleString()}
                </span>
                <span>{p.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {task.status === "conflict" &&
        showSlots &&
        onPickSlot &&
        (task.suggestions?.length ?? 0) > 0 && (
          <div className="mt-2 ml-9 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-800">
            <div className="mb-2 text-[11px] text-slate-500">
              Choose one of these open slots:
            </div>
            <div className="flex flex-col gap-2">
              {task.suggestions!.map((s) => (
                <button
                  key={`${s.start}-${s.end}`}
                  type="button"
                  onClick={() => onPickSlot(s)}
                  className="rounded-md border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
                >
                  <div className="font-medium">
                    {new Date(s.start).toLocaleString()} –{" "}
                    {new Date(s.end).toLocaleTimeString()}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
    </div>
  );
}
