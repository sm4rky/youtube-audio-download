import type { StateStorage } from 'zustand/middleware';

// Session storage is extension-only. Storage failures fall back to memory so
// they cannot prevent the popup from reading a video or searching.
export const sessionStorage = {
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
