import Dexie, { type Table } from "dexie";
import type { Task, PendingOp } from "@/types/tasks";

export class LifeboardDB extends Dexie {
  tasks!: Table<Task, string>;
  pendingOps!: Table<PendingOp, string>;

  constructor() {
    super("lifeboard-db");
    this.version(2).stores({
      tasks: "id, serverId, syncStatus, updatedAt",
      pendingOps: "id, localId, createdAt",
    });
  }
}

export const db = new LifeboardDB();

export async function getAllTasks(): Promise<Task[]> {
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

export async function getPendingOps(): Promise<PendingOp[]> {
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
