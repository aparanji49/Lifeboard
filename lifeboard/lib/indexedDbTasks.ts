import { openDB } from "idb";
import type { Task } from "@/types/tasks";

const DB_NAME = "lifeboard-db";
const STORE_NAME = "tasks";
const DB_VERSION = 1;

async function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    },
  });
}

export async function getAllTasks(): Promise<Task[]> {
  const db = await getDb();
  return db.getAll(STORE_NAME);
}

export async function putTask(task: Task) {
  const db = await getDb();
  await db.put(STORE_NAME, task);
}

export async function putTasks(tasks: Task[]) {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  for (const t of tasks) tx.store.put(t);
  await tx.done;
}

export async function deleteTask(id: string) {
  const db = await getDb();
  await db.delete(STORE_NAME, id);
}
