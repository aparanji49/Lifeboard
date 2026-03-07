import Dexie, { type Table } from "dexie";
import type { Task, PendingOp } from "@/types/tasks";

export class LifeboardDB extends Dexie {
  tasks!: Table<Task, string>;
  pendingOps!: Table<PendingOp, string>;

  constructor() {
    super("lifeboard-db");
    this.version(3).stores({
      tasks: "id, ownerId, serverId, syncStatus, updatedAt",
      pendingOps: "id, ownerId, localId, createdAt",
    });
  }
}

export const db = new LifeboardDB();

export async function getAllTasks(ownerId?: string): Promise<Task[]> {
  if (ownerId) {
    return db.tasks
      .where("ownerId")
      .equals(ownerId)
      .sortBy("updatedAt")
      .then((rows) => rows.reverse());
  }
  return db.tasks.orderBy("updatedAt").reverse().toArray();
}

export async function putTask(task: Task): Promise<void> {
  await db.tasks.put(task);
}

export async function putTasks(tasks: Task[]): Promise<void> {
  await db.tasks.bulkPut(tasks);
}

export async function deleteTask(id: string): Promise<void> {
  await db.tasks.delete(id);
}

export async function getPendingOps(ownerId?: string): Promise<PendingOp[]> {
  if (ownerId) {
    return db.pendingOps.where("ownerId").equals(ownerId).sortBy("createdAt");
  }
  return db.pendingOps.orderBy("createdAt").toArray();
}

export async function addPendingOp(op: PendingOp): Promise<void> {
  await db.pendingOps.add(op);
}

export async function removePendingOp(id: string): Promise<void> {
  await db.pendingOps.delete(id);
}

export async function clearPendingOps(): Promise<void> {
  await db.pendingOps.clear();
}
