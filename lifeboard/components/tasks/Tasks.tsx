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
    updateTaskText,
    scheduleTask,
    retryScheduleTask,
    removeTask,
  } = useTasks();

  const total = tasks.length;
  const openCount = tasks.filter((t) => t.status !== "completed").length;
  const scheduledCount = tasks.filter((t) => t.status === "scheduled").length;

  // when user edits after conflict, update rawText/title then re-schedule
  const handleConflictEdit = async (id: string, newRawText: string) => {
    // simple version: update both rawText & title, then call scheduleTask
    // you can move this into useTasks later if you want.
    await updateTaskText(id, newRawText); // this currently only updates title
    // if you want rawText too, adjust updateTaskText implementation
    await scheduleTask(id);
  };

  return (
    <div className="flex flex-col lifeboard-card">
      <TaskHeader
        total={total}
        openCount={openCount}
        scheduledCount={scheduledCount}
      />

      <div className="flex-1 rounded-3xl bg-[#E8FCFD] px-6 py-4 shadow-inner">
        {loading ? (
          <p className="text-xs text-slate-500">Loading tasks…</p>
        ) : (
          <TaskList
            tasks={tasks}
            onToggleComplete={toggleComplete}
            onEditTitle={updateTaskText}
            onRetrySchedule={retryScheduleTask}
            onConflictEdit={handleConflictEdit}
            onDeleteTask={removeTask}
          />
        )}

        <TaskInput onSubmit={addTask} />
      </div>
    </div>
  );
}
