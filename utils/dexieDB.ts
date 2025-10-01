// src/utils/dexieDB.ts
import Dexie, { Table } from "dexie";

// 🔹 Define the Todo type (should match your other file)
export interface Todo {
  id: number;
  userId: number;
  title: string;
  completed: boolean;
}

// 🔹 Extend Dexie with types
class TodoDatabase extends Dexie {
  todos!: Table<Todo>;

  constructor() {
    super("TodoDatabase");
    this.version(1).stores({
      todos: "++id, title, completed, userId",
    });
  }
}

const db = new TodoDatabase();
export default db;