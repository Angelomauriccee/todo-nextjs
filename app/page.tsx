"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TodoListPage from "@/app/components/TodoListPage";

const queryClient = new QueryClient();

export default function Page() {
  return (
    <QueryClientProvider client={queryClient}>
      <TodoListPage />
    </QueryClientProvider>
  );
}
