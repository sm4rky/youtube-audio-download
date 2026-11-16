import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { chromeSessionStorage } from '../lib/chrome-session-storage.ts';
import { songDraftStateSchema } from '../schemas/song-draft.schema.ts';
import type { SongDraftState, SongDraftStore, SongDraftValues } from '../types/song-draft.ts';

function initialState(): SongDraftState {
  return { draft: null };
}

export function createSongDraftStore() {
  return create<SongDraftStore>()(persist((set, get) => ({
    ...initialState(),
    initializeDraft({ videoId, song, lyrics }) {
      const existing = get().draft;
      if (existing?.videoId === videoId && existing.geniusId === song.geniusId) return;
      const values: SongDraftValues = {
        metadata: {
          title: song.title,
          primaryArtists: song.primaryArtists,
          featuredArtists: song.featuredArtists,
          album: song.album,
          year: song.year,
          coverUrl: song.coverUrl,
        },
        plainLyrics: lyrics?.plainLyrics ?? null,
        syncedLyrics: lyrics?.syncedLyrics ?? null,
      };
      set({
        draft: {
          videoId,
          geniusId: song.geniusId,
          lrclibId: lyrics?.lrclibId ?? null,
          original: structuredClone(values),
          current: structuredClone(values),
        },
      });
    },
    updateDraft(identity, changes) {
      const draft = get().draft;
      if (draft?.videoId !== identity.videoId || draft.geniusId !== identity.geniusId) return;
      set({
        draft: {
          ...draft,
          current: { ...draft.current, ...structuredClone(changes) },
        },
      });
    },
    clearDraft() {
      set(initialState());
    },
  }), {
    name: 'audiomint-song-draft-v1',
    version: 1,
    skipHydration: true,
    storage: createJSONStorage(() => chromeSessionStorage),
    partialize: ({ draft }) => ({ draft }),
    merge: (saved, current) => {
      const result = songDraftStateSchema.safeParse(saved);
      return result.success ? { ...current, ...result.data } : current;
    },
  }));
}

export const useSongDraftStore = createSongDraftStore();
