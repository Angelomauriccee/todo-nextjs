// app/ClientRoot.tsx
"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TodoListPage from "../app/components/TodoListPage";

export default function ClientRoot() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <TodoListPage />
    </QueryClientProvider>
  );
}
