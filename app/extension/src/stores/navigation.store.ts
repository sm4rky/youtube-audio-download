import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { navigationStateSchema } from '../schemas/navigation.schema.ts';
import { sessionStorage } from '../storage/session-storage.ts';
import type { NavigationState, NavigationStore } from '../types/navigation.ts';

function initialState(): NavigationState {
  return { view: 'loading' };
}

export function createNavigationStore() {
  return create<NavigationStore>()(persist(
    (set) => ({
      ...initialState(),
      setView: (view) => set({ view }),
    }),
    {
      name: 'audiomint-navigation-v1',
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
      skipHydration: true,
      partialize: ({ view }) => ({ view }),
      merge: (saved, current) => {
        const result = navigationStateSchema.safeParse(saved);
        return result.success ? { ...current, ...result.data } : current;
      },
    },
  ));
}

export const useNavigationStore = createNavigationStore();
