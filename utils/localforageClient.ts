// utils/localforageClient.ts
// SSR-safe localforage wrapper with strict typing, no `any`.
// Lazy-loads the library only in the browser.

type LocalForageInstance = {
  getItem<T>(key: string): Promise<T | null>;
  setItem<T>(key: string, value: T): Promise<T>;
  removeItem(key: string): Promise<void>;
};

type LFModule = typeof import("localforage");

let lfPromise: Promise<LocalForageInstance> | null = null;

declare global {
  interface Window {
    // Optional: exposed for debugging in dev
    forageClient?: LocalForageInstance;
  }
}

async function getLF(): Promise<LocalForageInstance | null> {
  if (typeof window === "undefined") return null;
  if (!lfPromise) {
    lfPromise = import("localforage").then((m: LFModule) => {
      const instance = m.createInstance({
        name: "todo-cache",
        storeName: "todos",
      }) as unknown as LocalForageInstance;

      if (process.env.NODE_ENV === "development") {
        window.forageClient = instance;
      }
      return instance;
    });
  }
  return lfPromise;
}

const forageClient = {
  async getItem<T>(key: string): Promise<T | null> {
    const lf = await getLF();
    if (!lf) return null; // server: no-op
    return lf.getItem<T>(key);
  },
  async setItem<T>(key: string, value: T): Promise<T | null> {
    const lf = await getLF();
    if (!lf) return null; // server: no-op
    return lf.setItem<T>(key, value);
  },
  async removeItem(key: string): Promise<void> {
    const lf = await getLF();
    if (!lf) return; // server: no-op
    await lf.removeItem(key);
  },
};

export default forageClient;
