"use client";

import { useCallback, useEffect, useState } from "react";
import { nanoid } from "nanoid"; 
import type { Task, TaskStatus } from "@/types/tasks";
import { useSession } from "next-auth/react";
import {
  getAllTasks,
  putTask,
  deleteTask as dbDeleteTask,
} from "@/lib/db";
import { syncWhenOnline, queuePendingOp } from "@/lib/sync";
import { getUserTimeContext } from "@/lib/getBrowserTimezone";
import { timeDebug } from "@/lib/timeDebug";
import {
  parseJsonObject,
  scheduleErrorUserMessage,
  scheduleProgressOnFailure,
} from "@/lib/scheduleApiErrors";

export function useTasks() {
  const { data: session, status: sessionStatus } = useSession();
  const ownerId = session?.user?.id ?? null;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTasks = useCallback(async () => {
    if (!ownerId) {
      setTasks([]);
      return;
    }
    const list = await getAllTasks(ownerId);
    setTasks(list);
  }, [ownerId]);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    let cancelled = false;
    (async () => {
      try {
        await loadTasks();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionStatus, loadTasks]);

  useEffect(() => {
    if (!navigator.onLine) return;
    if (!ownerId) return;
    syncWhenOnline(ownerId).then((merged) => {
      setTasks(merged);
    });
  }, [ownerId]);

  useEffect(() => {
    const handleOnline = () => {
      if (!ownerId) return;
      syncWhenOnline(ownerId).then(setTasks);
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [ownerId]);

  const saveUpdatedTask = useCallback(async (updated: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    await putTask(updated);
  }, []);

  const appendProgress = useCallback(
    async (task: Task, message: string) => {
      const next: Task = {
        ...task,
        progress: [
          ...(task.progress ?? []),
          { ts: new Date().toISOString(), message },
        ].slice(-20),
      };
      await saveUpdatedTask(next);
      return next;
    },
    [saveUpdatedTask]
  );

  const scheduleTask = useCallback(async (id: string, taskOverride?: Task) => {
    const existing = tasks.find((t) => t.id === id);
    const task = taskOverride ?? existing;
    if (!task) return;

    try {
      const t1 = await appendProgress(task, "Calling scheduling API...");
      timeDebug("useTasks scheduleTask (text)", { text: task.rawText?.slice(0, 80), taskId: id });
      const res = await fetch("/api/tasks/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: task.rawText,
          userTimeContext: getUserTimeContext(),
        }),
      });
      const data = parseJsonObject(await res.text()) ?? {};
      const apiStatus = typeof data.status === "string" ? data.status : "";

      if (apiStatus === "scheduled") {
        const updated: Task = {
          ...t1,
          title: typeof data.title === "string" ? data.title : t1.title,
          description:
            typeof data.description === "string" ? data.description : t1.description,
          status: "scheduled",
          scheduledStart: typeof data.start === "string" ? data.start : undefined,
          scheduledEnd: typeof data.end === "string" ? data.end : undefined,
          calendarEventId:
            typeof data.calendarEventId === "string" ? data.calendarEventId : undefined,
          conflictMessage: undefined,
          errorMessage: undefined,
          updatedAt: new Date().toISOString(),
          progress: [
            ...(t1.progress ?? []),
            { ts: new Date().toISOString(), message: "Scheduled in Google Calendar." },
          ].slice(-20),
          suggestions: undefined,
        };
        await saveUpdatedTask(updated);
        if (task.serverId && navigator.onLine) {
          fetch(`/api/tasks/${task.serverId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updated),
          }).catch(() => {});
        }
        return updated;
      } else if (apiStatus === "conflict") {
        const updated: Task = {
          ...t1,
          title: typeof data.title === "string" ? data.title : t1.title,
          description:
            typeof data.description === "string" ? data.description : t1.description,
          status: "conflict",
          scheduledStart: typeof data.start === "string" ? data.start : undefined,
          scheduledEnd: typeof data.end === "string" ? data.end : undefined,
          conflictMessage:
            typeof data.conflictMessage === "string" ? data.conflictMessage : undefined,
          suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
          errorMessage: undefined,
          updatedAt: new Date().toISOString(),
          progress: [
            ...(t1.progress ?? []),
            { ts: new Date().toISOString(), message: "Conflict detected." },
          ].slice(-20),
        };
        await saveUpdatedTask(updated);
        return updated;
      } else {
        const errMsg = scheduleErrorUserMessage(res.status, data);
        const progressMsg = scheduleProgressOnFailure(res.status);
        const updated: Task = {
          ...t1,
          status: "failed",
          errorMessage: errMsg,
          updatedAt: new Date().toISOString(),
          progress: [
            ...(t1.progress ?? []),
            { ts: new Date().toISOString(), message: progressMsg },
          ].slice(-20),
        };
        await saveUpdatedTask(updated);
        return updated;
      }
    } catch {
      const updated: Task = {
        ...task,
        status: "failed",
        errorMessage: "Network error. Please retry.",
        updatedAt: new Date().toISOString(),
        progress: [
          ...(task.progress ?? []),
          { ts: new Date().toISOString(), message: "Network error while scheduling." },
        ].slice(-20),
      };
      await saveUpdatedTask(updated);
      return updated;
    }
  }, [tasks, saveUpdatedTask, appendProgress]);

  const addTask = useCallback(
    async (text: string) => {
      if (!ownerId) return;
      const now = new Date().toISOString();
      const newTask: Task = {
        id: nanoid(),
        ownerId,
        rawText: text,
        title: text,
        status: "unscheduled",
        createdAt: now,
        updatedAt: now,
        syncStatus: "pending",
        progress: [{ ts: now, message: "Saved locally (IndexedDB)" }],
      };

      setTasks((prev) => [...prev, newTask]);
      await putTask(newTask);
      if (!navigator.onLine) {
        await appendProgress(newTask, "Offline: queued for scheduling when back online.");
        queuePendingOp("schedule", ownerId, newTask.id, undefined, null);
        return;
      }

      try {
        const scheduledOrUpdated = await scheduleTask(newTask.id, newTask);
        const taskForServer = scheduledOrUpdated ?? newTask;

        // If conflict, wait for user to pick a slot (don't persist to server yet)
        if (taskForServer.status === "conflict") return;

        await appendProgress(taskForServer, "Syncing to server (PostgreSQL)...");
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(taskForServer),
        });
        if (res.ok) {
          const created = await res.json();
          const updated: Task = {
            ...taskForServer,
            serverId: created.serverId ?? created.id,
            syncStatus: "synced",
            progress:
              taskForServer.status === "scheduled"
                ? undefined
                : taskForServer.progress,
          };
          await saveUpdatedTask(updated);
        } else {
          await appendProgress(taskForServer, "Server sync failed; queued for retry.");
          queuePendingOp("create", ownerId, newTask.id, undefined, taskForServer);
        }
      } catch {
        await appendProgress(newTask, "Server sync failed; queued for retry.");
        queuePendingOp("create", ownerId, newTask.id, undefined, newTask);
      }
    },
    [ownerId, saveUpdatedTask, appendProgress, scheduleTask]
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
            if (ownerId) queuePendingOp("update", ownerId, task.id, task.serverId, updated);
          }
        } catch {
          if (ownerId) queuePendingOp("update", ownerId, task.id, task.serverId, updated);
        }
      } else if (!navigator.onLine) {
        if (ownerId) queuePendingOp("update", ownerId, task.id, task.serverId, updated);
      }
    },
    [tasks, saveUpdatedTask, ownerId]
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
            if (ownerId) queuePendingOp("update", ownerId, task.id, task.serverId, updated);
          }
        } catch {
          if (ownerId) queuePendingOp("update", ownerId, task.id, task.serverId, updated);
        }
      } else if (!navigator.onLine) {
        if (ownerId) queuePendingOp("update", ownerId, task.id, task.serverId, updated);
      }
    },
    [tasks, saveUpdatedTask, ownerId]
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
            if (ownerId) queuePendingOp("delete", ownerId, id, task.serverId, null);
          }
        } catch {
          if (ownerId) queuePendingOp("delete", ownerId, id, task.serverId, null);
        }
      } else if (task?.serverId) {
        if (ownerId) queuePendingOp("delete", ownerId, id, task.serverId, null);
      }
    },
    [tasks, ownerId]
  );

  const scheduleWithSlot = useCallback(
    async (id: string, slot: { start: string; end: string }) => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      if (!navigator.onLine) {
        await appendProgress(task, "Offline: cannot schedule selected slot yet.");
        return;
      }

      const t1 = await appendProgress(task, "Scheduling selected slot...");
      timeDebug("useTasks scheduleWithSlot (override)", {
        slot_start: slot.start,
        slot_end: slot.end,
        taskId: id,
      });
      try {
        const res = await fetch("/api/tasks/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            override: {
              title: t1.title,
              description: t1.description,
              start: slot.start,
              end: slot.end,
            },
            userTimeContext: getUserTimeContext(),
          }),
        });
        const data = parseJsonObject(await res.text()) ?? {};
        const apiStatus = typeof data.status === "string" ? data.status : "";
        if (apiStatus !== "scheduled") {
          const errMsg = scheduleErrorUserMessage(res.status, data);
          await saveUpdatedTask({
            ...t1,
            status: "failed",
            errorMessage: errMsg,
            updatedAt: new Date().toISOString(),
            progress: [
              ...(t1.progress ?? []),
              {
                ts: new Date().toISOString(),
                message: scheduleProgressOnFailure(res.status),
              },
            ].slice(-20),
          });
          return;
        }

        const updated: Task = {
          ...t1,
          status: "scheduled",
          scheduledStart: typeof data.start === "string" ? data.start : undefined,
          scheduledEnd: typeof data.end === "string" ? data.end : undefined,
          calendarEventId:
            typeof data.calendarEventId === "string" ? data.calendarEventId : undefined,
          conflictMessage: undefined,
          errorMessage: undefined,
          suggestions: undefined,
          updatedAt: new Date().toISOString(),
          progress: [
            ...(t1.progress ?? []),
            { ts: new Date().toISOString(), message: "Scheduled in Google Calendar." },
          ].slice(-20),
        };
        await saveUpdatedTask(updated);

        // Persist to server
        await appendProgress(updated, "Syncing to server (PostgreSQL)...");
        const serverRes = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        });
        if (serverRes.ok) {
          const created = await serverRes.json();
          await saveUpdatedTask({
            ...updated,
            serverId: created.serverId ?? created.id,
            syncStatus: "synced",
            progress: undefined,
          });
        } else {
          await appendProgress(updated, "Server sync failed; queued for retry.");
          if (ownerId) queuePendingOp("create", ownerId, updated.id, undefined, updated);
        }
      } catch {
        await appendProgress(t1, "Network error scheduling selected slot.");
      }
    },
    [tasks, appendProgress, saveUpdatedTask, ownerId]
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
    scheduleWithSlot,
  };
}
