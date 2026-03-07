// lifeboard/components/tasks/Tasks.tsx
"use client";

import { useTasks } from "@/hooks/useTasks";
import { TaskHeader } from "./TaskHeader";
import { TaskList } from "./TaskList";
import { TaskInput } from "./TaskInput";

export default function Tasks() {
  const {
    tasks,
    loading,
    addTask,
    toggleComplete,
    retryScheduleTask,
    handleConflictEdit,
    scheduleWithSlot,
  } = useTasks();

  const total = tasks.length;
  const openCount = tasks.filter((t) => t.status !== "completed").length;
  const scheduledCount = tasks.filter((t) => t.status === "scheduled").length;

  return (
    <div className="flex flex-col lifeboard-card w-full max-w-5xl mx-auto px-4">
      <TaskHeader
        total={total}
        openCount={openCount}
        scheduledCount={scheduledCount}
      />

      <div className="flex-1 rounded-3xl px-6 py-4">
        {loading ? (
          <p className="text-xs text-slate-500">Loading tasks…</p>
        ) : (
          <TaskList
            tasks={tasks}
            onToggleComplete={toggleComplete}
            onRetrySchedule={retryScheduleTask}
            onConflictEdit={handleConflictEdit}
            onPickSlot={scheduleWithSlot}
          />
        )}

        <TaskInput onSubmit={addTask} />
      </div>
    </div>
  );
}
