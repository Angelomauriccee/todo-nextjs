// utils/dexieDB.ts
import Dexie, { Table } from "dexie";

export interface Todo {
  id: number;
  userId: number;
  title: string;
  completed: boolean;
}

class TodoDatabase extends Dexie {
  todos!: Table<Todo, number>;

  constructor() {
    super("TodoDatabase");
    this.version(1).stores({
      todos: "++id, title, completed, userId",
    });
  }
}

const db = new TodoDatabase();
export default db;
