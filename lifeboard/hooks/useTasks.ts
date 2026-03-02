"use client";

import { useCallback, useEffect, useState } from "react";
import { nanoid } from "nanoid"; 
import type { Task, TaskStatus } from "@/types/tasks";
import {
  getAllTasks,
  putTask,
  deleteTask as dbDeleteTask,
} from "@/lib/db";
import { syncWhenOnline, queuePendingOp } from "@/lib/sync";

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTasks = useCallback(async () => {
    const list = await getAllTasks();
    setTasks(list);
  }, []);

  useEffect(() => {
    loadTasks().then(() => setLoading(false));
  }, [loadTasks]);

  useEffect(() => {
    if (!navigator.onLine) return;
    syncWhenOnline().then((merged) => {
      setTasks(merged);
    });
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      syncWhenOnline().then(setTasks);
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  const saveUpdatedTask = useCallback(async (updated: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    await putTask(updated);
  }, []);

  const addTask = useCallback(
    async (text: string) => {
      const now = new Date().toISOString();
      const newTask: Task = {
        id: nanoid(),
        rawText: text,
        title: text,
        status: "unscheduled",
        createdAt: now,
        updatedAt: now,
        syncStatus: "pending",
      };

      setTasks((prev) => [...prev, newTask]);
      await putTask(newTask);
      await scheduleTask(newTask.id, newTask);

      if (!navigator.onLine) {
        queuePendingOp("create", newTask.id, undefined, newTask);
        return;
      }

      try {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newTask),
        });
        if (res.ok) {
          const created = await res.json();
          const updated: Task = {
            ...newTask,
            serverId: created.serverId ?? created.id,
            syncStatus: "synced",
          };
          await saveUpdatedTask(updated);
        } else {
          queuePendingOp("create", newTask.id, undefined, newTask);
        }
      } catch {
        queuePendingOp("create", newTask.id, undefined, newTask);
      }
    },
    [saveUpdatedTask]
  );

  const updateTaskStatus = useCallback(
    async (id: string, status: TaskStatus) => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      const updated: Task = {
        ...task,
        status,
        updatedAt: new Date().toISOString(),
      };
      await saveUpdatedTask(updated);

      if (navigator.onLine && task.serverId) {
        try {
          const res = await fetch(`/api/tasks/${task.serverId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updated),
          });
          if (res.ok) {
            const fromServer = await res.json();
            await saveUpdatedTask({ ...fromServer, id: task.id });
          } else {
            queuePendingOp("update", task.id, task.serverId, updated);
          }
        } catch {
          queuePendingOp("update", task.id, task.serverId, updated);
        }
      } else if (!navigator.onLine) {
        queuePendingOp("update", task.id, task.serverId, updated);
      }
    },
    [tasks, saveUpdatedTask]
  );

  const toggleComplete = useCallback(
    async (id: string) => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      const status: TaskStatus =
        task.status === "completed" ? "unscheduled" : "completed";
      await updateTaskStatus(id, status);
    },
    [tasks, updateTaskStatus]
  );

  const updateTaskText = useCallback(
    async (id: string, text: string) => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      const updated: Task = {
        ...task,
        title: text,
        rawText: text,
        updatedAt: new Date().toISOString(),
      };
      await saveUpdatedTask(updated);

      if (navigator.onLine && task.serverId) {
        try {
          const res = await fetch(`/api/tasks/${task.serverId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updated),
          });
          if (!res.ok) {
            queuePendingOp("update", task.id, task.serverId, updated);
          }
        } catch {
          queuePendingOp("update", task.id, task.serverId, updated);
        }
      } else if (!navigator.onLine) {
        queuePendingOp("update", task.id, task.serverId, updated);
      }
    },
    [tasks, saveUpdatedTask]
  );

  const removeTask = useCallback(
    async (id: string) => {
      const task = tasks.find((t) => t.id === id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      await dbDeleteTask(id);

      if (task?.serverId && navigator.onLine) {
        try {
          const res = await fetch(`/api/tasks/${task.serverId}`, {
            method: "DELETE",
          });
          if (!res.ok) {
            queuePendingOp("delete", id, task.serverId, null);
          }
        } catch {
          queuePendingOp("delete", id, task.serverId, null);
        }
      } else if (task?.serverId) {
        queuePendingOp("delete", id, task.serverId, null);
      }
    },
    [tasks]
  );

  const scheduleTask = useCallback(
    async (id: string, taskOverride?: Task) => {
      const existing = tasks.find((t) => t.id === id);
      const task = taskOverride ?? existing;
      if (!task) return;

      try {
        const res = await fetch("/api/tasks/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: task.rawText }),
        });
        const data = await res.json();

        if (data.status === "scheduled") {
          const updated: Task = {
            ...task,
            title: data.title,
            description: data.description,
            status: "scheduled",
            scheduledStart: data.start,
            scheduledEnd: data.end,
            calendarEventId: data.calendarEventId,
            conflictMessage: undefined,
            errorMessage: undefined,
            updatedAt: new Date().toISOString(),
          };
          await saveUpdatedTask(updated);
          if (task.serverId && navigator.onLine) {
            fetch(`/api/tasks/${task.serverId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(updated),
            }).catch(() => {});
          }
        } else if (data.status === "conflict") {
          const updated: Task = {
            ...task,
            title: data.title,
            description: data.description,
            status: "conflict",
            scheduledStart: data.start,
            scheduledEnd: data.end,
            conflictMessage: data.conflictMessage,
            errorMessage: undefined,
            updatedAt: new Date().toISOString(),
          };
          await saveUpdatedTask(updated);
        } else {
          const updated: Task = {
            ...task,
            status: "failed",
            errorMessage: data.message ?? "Unknown error",
            updatedAt: new Date().toISOString(),
          };
          await saveUpdatedTask(updated);
        }
      } catch {
        const updated: Task = {
          ...task,
          status: "failed",
          errorMessage: "Network error. Please retry.",
          updatedAt: new Date().toISOString(),
        };
        await saveUpdatedTask(updated);
      }
    },
    [tasks, saveUpdatedTask]
  );

  const retryScheduleTask = useCallback(
    (id: string) => scheduleTask(id),
    [scheduleTask]
  );

  const handleConflictEdit = useCallback(
    async (id: string, newRawText: string) => {
      await updateTaskText(id, newRawText);
      await scheduleTask(id);
    },
    [updateTaskText, scheduleTask]
  );

  return {
    tasks,
    loading,
    addTask,
    updateTaskStatus,
    toggleComplete,
    updateTaskText,
    removeTask,
    scheduleTask,
    retryScheduleTask,
    handleConflictEdit,
  };
}
