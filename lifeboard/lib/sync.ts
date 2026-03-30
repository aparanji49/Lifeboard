import { nanoid } from "nanoid";
import type { Task, PendingOp } from "@/types/tasks";
import {
  db,
  getAllTasks,
  putTask,
  putTasks,
  getPendingOps,
  addPendingOp,
  removePendingOp,
} from "./db";
import { getUserTimeContext } from "./getBrowserTimezone";
import {
  isScheduleRateLimited,
  parseJsonObject,
  scheduleErrorUserMessage,
} from "./scheduleApiErrors";

async function processScheduleOps(ownerId: string) {
  const ops = (await getPendingOps(ownerId)).filter((o) => o.type === "schedule");
  for (const op of ops) {
    const task = await db.tasks.get(op.localId);
    if (!task) {
      await removePendingOp(op.id);
      continue;
    }

    // Only schedule tasks that still need scheduling
    if (task.status !== "unscheduled" && task.status !== "failed") {
      await removePendingOp(op.id);
      continue;
    }

    try {
      const res = await fetch("/api/tasks/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: task.rawText,
          userTimeContext: getUserTimeContext(),
        }),
      });
      const data = parseJsonObject(await res.text()) ?? {};

      if (isScheduleRateLimited(res.status)) {
        // Keep schedule op in queue; retry on next online sync (FIFO preserved).
        break;
      }

      const apiStatus = typeof data.status === "string" ? data.status : "";

      if (apiStatus === "scheduled") {
        const updated = {
          ...task,
          title: typeof data.title === "string" ? data.title : task.title,
          description:
            typeof data.description === "string" ? data.description : task.description,
          status: "scheduled" as const,
          scheduledStart: typeof data.start === "string" ? data.start : undefined,
          scheduledEnd: typeof data.end === "string" ? data.end : undefined,
          calendarEventId:
            typeof data.calendarEventId === "string" ? data.calendarEventId : undefined,
          conflictMessage: undefined,
          errorMessage: undefined,
          suggestions: undefined,
          updatedAt: new Date().toISOString(),
          syncStatus: "pending" as const,
        };
        await putTask(updated);

        // Persist to server (create or patch)
        const serverRes = await fetch(
          updated.serverId ? `/api/tasks/${updated.serverId}` : "/api/tasks",
          {
            method: updated.serverId ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updated),
          }
        );

        if (serverRes.ok) {
          const row = serverRes.status === 204 ? null : await serverRes.json();
          if (row && !updated.serverId) {
            await putTask({
              ...updated,
              serverId: row.serverId ?? row.id,
              syncStatus: "synced",
            });
          } else {
            await putTask({ ...updated, syncStatus: "synced" });
          }
        } else {
          addPendingOp({
            id: nanoid(),
            ownerId,
            type: "create",
            localId: updated.id,
            serverId: updated.serverId,
            payload: updated,
            createdAt: new Date().toISOString(),
          });
        }

        await removePendingOp(op.id);
      } else if (apiStatus === "conflict") {
        await putTask({
          ...task,
          title: typeof data.title === "string" ? data.title : task.title,
          description:
            typeof data.description === "string" ? data.description : task.description,
          status: "conflict",
          scheduledStart: typeof data.start === "string" ? data.start : undefined,
          scheduledEnd: typeof data.end === "string" ? data.end : undefined,
          conflictMessage:
            typeof data.conflictMessage === "string" ? data.conflictMessage : undefined,
          suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
          errorMessage: undefined,
          updatedAt: new Date().toISOString(),
        });
        // conflict requires user action; remove schedule op
        await removePendingOp(op.id);
      } else {
        await putTask({
          ...task,
          status: "failed",
          errorMessage: scheduleErrorUserMessage(res.status, data),
          updatedAt: new Date().toISOString(),
        });
        // keep in queue if it's a transient error? for now, remove to avoid infinite loops
        await removePendingOp(op.id);
      }
    } catch {
      // network failure -> stop processing to preserve FIFO and retry later
      break;
    }
  }
}

export async function pushPendingOps(
  ownerId: string
): Promise<{ pushed: number; errors: number }> {
  const ops = (await getPendingOps(ownerId)).filter((o) => o.type !== "schedule");
  let pushed = 0;
  let errors = 0;

  for (const op of ops) {
    try {
      const res = await fetch("/api/tasks" + (op.serverId ? `/${op.serverId}` : ""), {
        method: op.type === "create" ? "POST" : op.type === "delete" ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body:
          op.type === "delete" || !op.payload
            ? undefined
            : JSON.stringify(op.type === "create" ? op.payload : op.payload),
      });

      if (res.ok) {
        if (op.type === "create" && res.status !== 204) {
          const created = await res.json();
          const local = await db.tasks.get(op.localId);
          if (local) {
            await putTask({
              ...local,
              serverId: created.serverId ?? created.id,
              syncStatus: "synced",
            });
          }
        } else if (op.type === "update" && res.status === 200) {
          const updated = await res.json();
          await putTask({ ...updated, id: op.localId });
        }
        await removePendingOp(op.id);
        pushed++;
      } else {
        errors++;
      }
    } catch {
      errors++;
    }
  }

  return { pushed, errors };
}

export async function pullAndMerge(ownerId: string): Promise<Task[]> {
  const res = await fetch("/api/tasks");
  if (!res.ok) return getAllTasks(ownerId);

  const serverTasks: Task[] = await res.json();
  const localTasks = await getAllTasks(ownerId);
  const localByServerId = new Map<string, Task>();
  const localOnly: Task[] = [];

  for (const t of localTasks) {
    if (t.serverId) localByServerId.set(t.serverId, t);
    else localOnly.push(t);
  }

  const merged: Task[] = [...localOnly];
  for (const st of serverTasks) {
    const serverId = st.serverId ?? st.id;
    merged.push({
      ...st,
      id: localByServerId.get(serverId)?.id ?? st.id,
      serverId,
      syncStatus: "synced",
      ownerId,
    });
  }

  merged.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  await putTasks(merged);
  return merged;
}

export async function syncWhenOnline(ownerId: string): Promise<Task[]> {
  if (!navigator.onLine) return getAllTasks(ownerId);
  // 1) run scheduling queue FIFO first
  await processScheduleOps(ownerId);
  await pushPendingOps(ownerId);
  return pullAndMerge(ownerId);
}

export function queuePendingOp(
  type: PendingOp["type"],
  ownerId: string,
  localId: string,
  serverId: string | undefined,
  payload: Partial<Task> | null
): void {
  addPendingOp({
    id: nanoid(),
    ownerId,
    type,
    localId,
    serverId,
    payload,
    createdAt: new Date().toISOString(),
  });
}
