import type { StateStorage } from 'zustand/middleware';

// Adapt chrome.storage.session to the storage interface used by Zustand and the query persister.
// Failed reads return null; failed writes and removals are ignored so the popup can keep working.
// In-memory state remains usable, but persistence across popup reopen is not guaranteed on failure.
export const chromeSessionStorage = {
  async getItem(name) {
    try {
      const storage = globalThis.chrome?.storage?.session;
      if (!storage) return null;
      const items = await storage.get(name);
      return typeof items[name] === 'string' ? items[name] : null;
    } catch {
      return null;
    }
  },
  async setItem(name, value) {
    try {
      await globalThis.chrome?.storage?.session?.set({ [name]: value });
    } catch {
      // Search remains usable when session storage is unavailable or full.
    }
  },
  async removeItem(name) {
    try {
      await globalThis.chrome?.storage?.session?.remove(name);
    } catch {
      // The in-memory flow can continue without persisted state.
    }
  },
} satisfies StateStorage;
