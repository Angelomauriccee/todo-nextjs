// utils/localforageClient.ts
import localforage from "localforage";

// Create a named instance (same as before)
const forageClient: LocalForage = localforage.createInstance({
  name: "todo-cache",
  storeName: "todos",
});

// Optional: expose for debugging in dev, but only in the browser
declare global {
  interface Window {
    forageClient?: LocalForage;
  }
}

if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  window.forageClient = forageClient;
}

export default forageClient;
