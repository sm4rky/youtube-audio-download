import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { chromeSessionStorage } from '../lib/chrome-session-storage.ts';
import { selectedSongStateSchema } from '../schemas/selected-song.schema.ts';
import type { SelectedSongState, SelectedSongStore } from '../types/selected-song.ts';

function initialState(): SelectedSongState { return { selectedSongId: null }; }

export function createSelectedSongStore() {
  return create<SelectedSongStore>()(persist((set) => ({ ...initialState(), selectSong: (selectedSongId) => set({ selectedSongId }) }), {
    name: 'audiomint-selected-song-v1', version: 1, skipHydration: true,
    storage: createJSONStorage(() => chromeSessionStorage),
    partialize: ({ selectedSongId }) => ({ selectedSongId }),
    merge: (saved, current) => { const result = selectedSongStateSchema.safeParse(saved); return result.success ? { ...current, ...result.data } : current; },
  }));
}

export const useSelectedSongStore = createSelectedSongStore();
