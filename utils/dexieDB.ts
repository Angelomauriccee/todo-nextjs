// utils/dexieDB.ts
// Dexie instance only constructed in the browser.
// Exports a tiny API that safely no-ops on the server.

import Dexie, { Table } from "dexie";

// Keep a local copy of the Todo shape (avoid import cycles)
type ITodo = {
  id: number;
  userId: number;
  title: string;
  completed: boolean;
  isFake?: boolean;
};

class TodoDB extends Dexie {
  todos!: Table<ITodo, number>;
  constructor() {
    super("todo-nextjs-db");
    this.version(1).stores({
      todos: "id,userId,completed", // indexes
    });
    this.todos = this.table("todos");
  }
}

let _db: TodoDB | null = null;
if (typeof window !== "undefined") {
  _db = new TodoDB();
}

const api = {
  todos: {
    toArray: async (): Promise<ITodo[]> => (_db ? _db.todos.toArray() : []),
    clear: async (): Promise<void> => {
      if (_db) await _db.todos.clear();
    },
    bulkAdd: async (arr: ITodo[]): Promise<void> => {
      if (_db && arr?.length) await _db.todos.bulkAdd(arr);
    },
    put: async (todo: ITodo): Promise<number | void> => {
      if (_db) return _db.todos.put(todo);
    },
    add: async (todo: ITodo): Promise<number | void> => {
      if (_db) return _db.todos.add(todo);
    },
    delete: async (id: number): Promise<void> => {
      if (_db) await _db.todos.delete(id);
    },
  },
};

export default api;
