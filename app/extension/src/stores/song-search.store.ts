import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { songSearchStateSchema } from '../schemas/song-search.schema.ts';
import { sessionStorage } from '../storage/session-storage.ts';
import type {
  SongSearchDependencies,
  SongSearchState,
  SongSearchStore,
} from '../types/song-search.ts';
import {
  getActiveYouTubeTab,
  sendYouTubeMessage,
} from '../lib/chrome-tabs.ts';
import { YOUTUBE_MESSAGE } from '../lib/youtube-messages.ts';
import { validateManualQuery } from '../lib/song-title-normalizer.ts';
import { readYouTubeSource } from '../lib/youtube-source.ts';

function initialState(): SongSearchState {
  return {
    videoId: null,
    sourceStatus: 'idle',
    sourceError: null,
    title: '',
    automaticQuery: '',
    query: '',
    validationError: null,
  };
}

export function createSongSearchStore(
  dependencies: SongSearchDependencies,
) {
  return create<SongSearchStore>()(persist((set, get) => {
    let generation = 0;

    function invalidate(): number {
      generation += 1;
      return generation;
    }

    return {
      ...initialState(),
      async initialize({ restore = false } = {}): Promise<void> {
        const current = invalidate();
        const previous = get();
        set({ sourceStatus: 'loading', sourceError: null, validationError: null });
        for await (const update of readYouTubeSource(dependencies, previous, restore)) {
          if (current !== generation) return;
          set(update);
        }
      },
      submit(value: string): void {
        let query: string;
        try {
          query = validateManualQuery(value);
        } catch (error: unknown) {
          set({
            validationError:
              error instanceof Error ? error.message : 'Invalid search query.',
          });
          return;
        }
        set({ query, validationError: null });
      },
      dispose(): void {
        invalidate();
      },
    };
  }, {
    name: 'audiomint-song-search-v1',
    version: 1,
    storage: createJSONStorage(() => sessionStorage),
    skipHydration: true,
    partialize: ({ videoId, title, automaticQuery, query }) => ({
      videoId, title, automaticQuery, query,
    }),
    merge: (saved, current) => {
      const result = songSearchStateSchema.safeParse(saved);
      return result.success ? { ...current, ...result.data } : current;
    },
  }));
}

export const useSongSearchStore = createSongSearchStore({
  getActiveTab: getActiveYouTubeTab,
  getSnapshot: (tabId) =>
    sendYouTubeMessage(tabId, { type: YOUTUBE_MESSAGE.GET_SNAPSHOT }),
});
