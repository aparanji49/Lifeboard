"use client";

import { useEffect, useState } from "react";
import { nanoid } from "nanoid"; 
import type { Task, TaskStatus } from "@/types/tasks";
import { getAllTasks, putTask, deleteTask } from "@/lib/indexedDbTasks";

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllTasks().then((stored) => {
      setTasks(stored);
      setLoading(false);
    });
  }, []);

  // --- NEW: helper to update one task in state + IndexedDB ---
  const saveUpdatedTask = async (updated: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    await putTask(updated);
  };

  // ---- AUTO-SCHEDULING ON ADD ----
  const addTask = async (text: string) => {
    const now = new Date().toISOString();
    const newTask: Task = {
      id: nanoid(),
      rawText: text,
      title: text, // AI can refine later
      status: "unscheduled",
      createdAt: now,
      updatedAt: now,
    };

    // add as unscheduled first
    setTasks((prev) => [...prev, newTask]);
    await putTask(newTask);

    // immediately trigger automatic scheduling for this new task
    await scheduleTask(newTask.id, newTask);
  };

  // ---- TASK UPDATES ----
  // update status helper
  const updateTaskStatus = async (id: string, status: TaskStatus) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    const updated: Task = {
      ...task,
      status,
      updatedAt: new Date().toISOString(),
    };

    await saveUpdatedTask(updated);
  };

  // toggle between completed & unscheduled
  const toggleComplete = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const status: TaskStatus =
      task.status === "completed" ? "unscheduled" : "completed";
    await updateTaskStatus(id, status);
  };

  // update title & rawText
  const updateTaskText = async (id: string, text: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    const updated: Task = {
      ...task,
      title: text,
      rawText: text, // so AI uses new text on re-schedule
      updatedAt: new Date().toISOString(),
    };

    await saveUpdatedTask(updated);
  };

  // delete task
  const removeTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await deleteTask(id);
  };

  // ---- Agentic AI scheduling ----
  // NOTE: added optional `taskOverride` so addTask can pass the just-created task
  const scheduleTask = async (id: string, taskOverride?: Task) => {
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
        // error from API
        const updated: Task = {
          ...task,
          status: "failed",
          errorMessage: data.message ?? "Unknown error",
          updatedAt: new Date().toISOString(),
        };

        await saveUpdatedTask(updated);
      }
    } catch (err) {
      const updated: Task = {
        ...task,
        status: "failed",
        errorMessage: "Network error. Please retry.",
        updatedAt: new Date().toISOString(),
      };

      await saveUpdatedTask(updated);
    }
  };

  // Retry is only for errors
  const retryScheduleTask = (id: string) => scheduleTask(id);

  return {
    tasks,
    loading,
    addTask,               // now auto-schedules
    updateTaskStatus,
    toggleComplete,
    updateTaskText,
    removeTask,
    scheduleTask,          // for explicit calls if you want
    retryScheduleTask,     // used by TaskRow "Retry"
  };
}
