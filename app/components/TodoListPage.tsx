// components/TodoListPage.tsx
"use client";

import { Trash2, Search, Clock, CheckCircle2, Pencil, Loader } from "lucide-react";
import { Toaster, toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import forageClient from "@/utils/localforageClient"; // SSR-safe wrapper
import db from "@/utils/dexieDB"; // SSR-safe wrapper

// 🔹 Define Todo type
export interface Todo {
  id: number;
  userId: number;
  title: string;
  completed: boolean;
  isFake?: boolean; // for optimistic updates
}

export default function TodoListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedIdParam = searchParams.get("id");
  const selectedId = selectedIdParam ? Number(selectedIdParam) : undefined;

  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const todosPerPage = 10;
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "completed" | "incomplete">("all");
  const [newTodo, setNewTodo] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTodoStatus, setNewTodoStatus] = useState(false);
  const [addError, setAddError] = useState<string>("");
  const [editingTodoId, setEditingTodoId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCompleted, setEditCompleted] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Optional: keep page valid if filters/search reduce results
  useEffect(() => {
    setPage(1);
  }, [searchTerm, filter]);

  // 🔹 Handle edit click
  const handleEditClick = (todo: Todo) => {
    setEditingTodoId(todo.id);
    setEditTitle(todo.title);
    setEditCompleted(todo.completed);
  };

  // 🔹 Fetch todos
  const { data = [], isPending, isError } = useQuery<Todo[]>({
    queryKey: ["todos"],
    queryFn: async (): Promise<Todo[]> => {
      const isBrowser = typeof window !== "undefined";

      // Offline-first (browser only)
      if (isBrowser && typeof navigator !== "undefined" && !navigator.onLine) {
        const offlineTodos = await db.todos.toArray();
        return offlineTodos;
      }

      // localforage cache (browser only)
      if (isBrowser) {
        const cached = await forageClient.getItem<Todo[]>("todos");
        if (cached) return cached;
      }

      // Network
      const res = await fetch("https://jsonplaceholder.typicode.com/todos", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch todos");
      const todos: Todo[] = await res.json();

      // Persist (browser only)
      if (isBrowser) {
        await forageClient.setItem("todos", todos);
        await db.todos.clear();
        await db.todos.bulkAdd(todos);
      }

      return todos;
    },
  });

  // 🔹 Update todo
  const { mutateAsync: updateTodo } = useMutation({
    mutationFn: async ({ id, title, completed }: { id: number; title: string; completed: boolean }): Promise<Todo> => {
      if (id > 200) {
        // locally created (fake id) → just echo back
        return { id, userId: 1, title, completed, isFake: true };
      }
      const res = await fetch(`https://jsonplaceholder.typicode.com/todos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, completed }),
      });
      if (!res.ok) throw new Error("Failed to update");
      const updated = await res.json();
      return { ...updated, id, isFake: false };
    },
    onSuccess: async (updatedTodo) => {
      queryClient.setQueryData(["todos"], (old: Todo[] = []) =>
        old.map((todo) => (todo.id === updatedTodo.id ? { ...todo, ...updatedTodo } : todo))
      );
      await db.todos.put(updatedTodo);
      toast.success("Todo updated!");
    },
    onError: () => {
      toast.error("Failed to update todo");
    },
  });

  // 🔹 Handle update click
  const handleUpdate = async () => {
    if (!editingTodoId || editTitle.trim() === "") return;
    setUpdatingId(editingTodoId);
    try {
      await updateTodo({
        id: editingTodoId,
        title: editTitle,
        completed: editCompleted,
      });
      setEditingTodoId(null);
      setEditTitle("");
      setEditCompleted(false);
    } catch (error) {
      console.error("Update failed:", error);
    } finally {
      setUpdatingId(null);
    }
  };

  // 🔹 Add todo
  const { mutate: addTodo, isPending: isAdding } = useMutation({
    mutationFn: async (newTodo: Omit<Todo, "id">): Promise<Todo> => {
      const res = await fetch("https://jsonplaceholder.typicode.com/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTodo),
      });
      if (!res.ok) throw new Error("Failed to add todo");
      return res.json();
    },
    onSuccess: async (data) => {
      const todoWithId = { ...data, id: Date.now() + Math.random() }; // fake ID > 200
      queryClient.setQueryData(["todos"], (old: Todo[] = []) => [todoWithId, ...old]);
      await db.todos.add(todoWithId);
      toast.success("Todo added successfully!");
      setAddError("");
      setNewTodo("");
      setNewTodoStatus(false);
      setShowAddForm(false);
    },
    onError: (error: Error) => {
      toast.error("Failed to add todo: " + error.message);
    },
  });

  // 🔹 Delete todo
  const { mutate: deleteTodo } = useMutation({
    mutationFn: async (id: number) => {
      setDeletingId(id);
      if (id <= 200) {
        const res = await fetch(`https://jsonplaceholder.typicode.com/todos/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete");
      }
      return id;
    },
    onSuccess: async (_, id) => {
      queryClient.setQueryData(["todos"], (old: Todo[] = []) => old.filter((todo) => todo.id !== id));
      await db.todos.delete(id);
      toast.error("Todo deleted.");
      if (selectedId && Number(id) === Number(selectedId)) {
        router.push("/"); // close the side panel if it was open for this todo
      }
    },
    onError: () => {
      toast.error("Failed to delete todo");
    },
    onSettled: () => {
      setDeletingId(null);
    },
  });

  // 🔹 Filters
  const filteredTodos = data
    .filter((todo) => todo.title.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter((todo) => {
      if (filter === "completed") return todo.completed;
      if (filter === "incomplete") return !todo.completed;
      return true;
    });

  const startIndex = (page - 1) * todosPerPage;
  const currentTodos = filteredTodos.slice(startIndex, startIndex + todosPerPage);
  const selectedTodo = data.find((todo) => todo.id === selectedId);

  if (isPending) return <p className="p-6">Loading todos...</p>;
  if (isError) return <p className="p-6">Something went wrong loading the todos 😓</p>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Toaster position="top-right" richColors />

      {/* Header */}
      <div className="relative mb-6">
        <h2 className="text-4xl text-center font-extrabold text-white max-w-xl mx-auto leading-snug">
          <span className="relative inline-block">
            Todo
            <svg viewBox="0 0 286 73" fill="none" className="absolute -left-3 -right-2 -top-3 bottom-0 translate-y-1 w-[230%]">
              <motion.path
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                transition={{ duration: 1.25, ease: "easeInOut" }}
                d="M142.293 1C106.854 16.8908 6.08202 7.17705 1.23654 43.3756C-2.10604 68.3466 29.5633 73.2652 122.688 71.7518C215.814 70.2384 316.298 70.689 275.761 38.0785C230.14 1.37835 97.0503 24.4575 52.9384 1"
                stroke="#FACC15"
                strokeWidth="3"
              />
            </svg>
          </span>{" "}
          List
        </h2>
        <h3 className="text-white mt-2 text-3xl px-4">Hello!</h3>
        <p className="text-white mt-2 text-sm sm:text-base px-4">What’s on your list today?</p>
      </div>

      {/* Add Todo Form */}
      <div className="mb-4">
        <button
          onClick={() => setShowAddForm((prev) => !prev)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 border text-white rounded-3xl transition-transform duration-300 bg-[#18181B] border-[#3F3F46] hover:bg-[#151416]"
        >
          <motion.span animate={{ rotate: showAddForm ? 45 : 0 }} transition={{ duration: 0.3 }} className="text-2xl">
            +
          </motion.span>
        </button>

        <AnimatePresence>
          {showAddForm && (
            <motion.form
              key="add-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (newTodo.trim() === "") {
                  setAddError("Please enter a todo before adding.");
                  return;
                }
                addTodo({ userId: 1, title: newTodo, completed: newTodoStatus });
              }}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute z-50 left-1/2 -translate-x-1/2 w-full max-w-4xl px-6 overflow-hidden mt-2"
            >
              <div className="bg-[#1f1f22] border border-[#3F3F46] rounded-md p-4 flex flex-col gap-3 shadow-[0_0_20px_6px_rgba(117,43,255,0.3)]">
                <textarea
                  rows={3}
                  value={newTodo}
                  onChange={(e) => {
                    setNewTodo(e.target.value);
                    if (addError) setAddError("");
                  }}
                  placeholder="Add a new todo..."
                  className="custom-scroll w-full p-3 rounded bg-[#1f1f22] text-white placeholder-[#3F3F46] outline-none resize-none max-h-40 overflow-y-auto"
                />
                {addError && <p className="text-red-500 text-sm mt-1">{addError}</p>}
                <div className="flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => setNewTodoStatus((prev) => !prev)}
                    className="flex items-center gap-1 text-sm px-2 py-1 rounded bg-[#27272A] text-white hover:bg-[#3F3F46]"
                  >
                    {newTodoStatus ? (
                      <>
                        <CheckCircle2 size={16} className="text-green-500" />
                        <span>Completed</span>
                      </>
                    ) : (
                      <>
                        <Clock size={16} className="text-yellow-400" />
                        <span>Pending</span>
                      </>
                    )}
                  </button>
                  <div className="absolute bottom-4 right-9">
                    <button
                      type="submit"
                      disabled={isAdding}
                      className="px-4 py-1 rounded bg-[#752bff] text-white font-semibold text-sm hover:bg-[#8746ff]"
                    >
                      {isAdding ? "Adding..." : "Add"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4 w-full">
        <div className="relative w-full sm:w-1/2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#3F3F46]" size={18} />
          <input
            type="text"
            placeholder="Search by title..."
            className="w-full pl-10 pr-4 py-2 rounded bg-[#18181B] text-[#ffffff] placeholder-[#3F3F46] border border-[#3F3F46] focus:outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="relative w-full sm:w-1/2 flex justify-between bg-[#18181B] rounded overflow-hidden border border-[#3F3F46]">
          <motion.div
            className="absolute top-0 bottom-0 w-1/3 bg-[#752bff] rounded z-0"
            animate={{
              x: filter === "all" ? "0%" : filter === "completed" ? "100%" : "200%",
            }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
          />
          {(["all", "completed", "incomplete"] as const).map((option) => (
            <button
              key={option}
              onClick={() => setFilter(option)}
              className={`w-1/3 py-2 z-10 text-sm font-semibold text-center transition-colors duration-300 ${
                filter === option ? "text-white" : "text-[#3F3F46]"
              }`}
            >
              {option[0].toUpperCase() + option.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Todo List */}
      <motion.ul layout className="space-y-2 min-h-[50vh]" initial={false}>
        <AnimatePresence mode="sync">
          {currentTodos.map((todo) => (
            <motion.li
              key={todo.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.25 }}
              onClick={() => (editingTodoId === todo.id ? null : router.push(`/?id=${todo.id}`))}
              className="p-4 rounded flex justify-between items-center border cursor-pointer"
              style={{
                backgroundColor: "#18181B",
                borderColor: "#3F3F46",
                color: "white",
              }}
            >
              {editingTodoId === todo.id ? (
                <div className="flex flex-col gap-3 w-full">
                  <textarea
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="custom-scroll w-full p-2 bg-transparent text-white rounded outline-none resize-none"
                    placeholder="Edit todo title"
                  />
                  <div className="flex justify-between items-center mt-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditCompleted(!editCompleted);
                      }}
                      className={`flex items-center gap-2 text-sm px-3 py-1 rounded ${
                        editCompleted ? "bg-green-700 text-green-200" : "bg-yellow-600 text-yellow-100"
                      }`}
                    >
                      {editCompleted ? (
                        <>
                          <CheckCircle2 size={16} /> Completed
                        </>
                      ) : (
                        <>
                          <Clock size={16} /> Pending
                        </>
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdate();
                      }}
                      disabled={updatingId === editingTodoId}
                      className="bg-[#752bff] hover:bg-[#8746ff] text-white px-4 py-1.5 rounded flex items-center justify-center min-w-[100px]"
                    >
                      {updatingId === editingTodoId ? <Loader className="animate-spin w-5 h-5" /> : "Update"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 w-full">
                  <span className="flex-1">{todo.title}</span>
                  <span className="flex items-center gap-1 text-sm font-medium">
                    {todo.completed ? (
                      <>
                        <CheckCircle2 className="text-green-500" size={18} />
                        <span className="text-green-400">Completed</span>
                      </>
                    ) : (
                      <>
                        <Clock className="text-yellow-400" size={18} />
                        <span className="text-yellow-300">Pending</span>
                      </>
                    )}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditClick(todo);
                    }}
                    className="bg-[#2D2D42] text-[#A1A1FF] hover:bg-[#4F46E5] hover:text-white p-2 rounded"
                    title="Edit todo"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTodo(todo.id);
                    }}
                    className="bg-[#443030] text-[#CC9194] hover:bg-[#DC2626] hover:text-white p-2 rounded"
                  >
                    {deletingId === todo.id ? <Loader className="animate-spin w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>

      {/* Detail Panel */}
      <AnimatePresence>
        {selectedTodo && (
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed top-0 right-0 h-full w-full sm:w-[400px] bg-[#18181B] text-white shadow-lg z-50 p-6 overflow-auto"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Todo Details</h2>
              <button onClick={() => router.push("/")} className="text-white bg-[#752bff] hover:bg-[#8746ff] px-3 py-1 rounded">
                Close
              </button>
            </div>
            <p><strong>ID:</strong> {selectedTodo.id}</p>
            <p><strong>Title:</strong> {selectedTodo.title}</p>
            <p><strong>Status:</strong> {selectedTodo.completed ? "Completed ✅" : "Pending ⏳"}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pagination */}
      <div className="flex justify-center mt-6 gap-4">
        <button
          onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
          disabled={page === 1}
          className="px-4 py-2 bg-[#752bff] hover:bg-[#8746ff] text-white rounded disabled:opacity-50"
        >
          Previous
        </button>
        <button
          onClick={() => setPage((prev) => prev + 1)}
          disabled={startIndex + todosPerPage >= filteredTodos.length}
          className="px-4 py-2 bg-[#752bff] hover:bg-[#8746ff] text-white rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
