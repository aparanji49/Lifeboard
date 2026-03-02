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

export async function pushPendingOps(): Promise<{ pushed: number; errors: number }> {
  const ops = await getPendingOps();
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

export async function pullAndMerge(): Promise<Task[]> {
  const res = await fetch("/api/tasks");
  if (!res.ok) return getAllTasks();

  const serverTasks: Task[] = await res.json();
  const localTasks = await getAllTasks();
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
    });
  }

  merged.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  await putTasks(merged);
  return merged;
}

export async function syncWhenOnline(): Promise<Task[]> {
  if (!navigator.onLine) return getAllTasks();
  await pushPendingOps();
  return pullAndMerge();
}

export function queuePendingOp(
  type: PendingOp["type"],
  localId: string,
  serverId: string | undefined,
  payload: Partial<Task> | null
): void {
  addPendingOp({
    id: nanoid(),
    type,
    localId,
    serverId,
    payload,
    createdAt: new Date().toISOString(),
  });
}
