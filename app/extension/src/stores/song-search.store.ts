import { create, type StoreApi, type UseBoundStore } from 'zustand';
import type {
  SongSearchDependencies,
  SongSearchState,
  SongSearchStore,
} from '../types/song-search.ts';
import {
  getActiveYouTubeTabId,
  sendYouTubeMessage,
  YouTubeClientError,
} from '../lib/chrome-tabs.ts';
import { YOUTUBE_MESSAGE } from '../lib/youtube-messages.ts';
import {
  normalizeTitleToQuery,
  validateManualQuery,
} from '../lib/song-title-normalizer.ts';

function initialState(): SongSearchState {
  return {
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
): UseBoundStore<StoreApi<SongSearchStore>> {
  return create<SongSearchStore>()((set) => {
    let generation = 0;

    function invalidate(): number {
      generation += 1;
      return generation;
    }

    return {
      ...initialState(),
      async initialize(): Promise<void> {
        const current = invalidate();
        set({ ...initialState(), sourceStatus: 'loading' });
        try {
          const tabId = await dependencies.getActiveTabId();
          if (current !== generation) return;
          const response = await dependencies.getSnapshot(tabId);
          if (current !== generation) return;
          if (!response.ok) {
            set({
              sourceStatus: 'unavailable',
              sourceError:
                'The YouTube player is not ready. Let the video load and retry.',
            });
            return;
          }
          if (response.snapshot.videoId === null) {
            set({
              sourceStatus: 'unsupported',
              sourceError: 'Open a YouTube watch video, then retry.',
            });
            return;
          }
          const title = response.snapshot.title;
          const query = normalizeTitleToQuery(title);
          if (!query) {
            set({
              sourceStatus: 'unavailable',
              sourceError:
                'The video title is not ready. Let the page load and retry.',
            });
            return;
          }
          set({ sourceStatus: 'ready', title, automaticQuery: query, query });
        } catch (error: unknown) {
          if (current !== generation) return;
          const unsupported =
            error instanceof YouTubeClientError &&
            error.code === 'UNSUPPORTED_TAB';
          let sourceError =
            'Cannot read the YouTube video. Reload the tab if needed, then retry.';
          if (error instanceof YouTubeClientError) sourceError = error.message;
          if (unsupported)
            sourceError = 'Open a YouTube watch video, then retry.';
          set({
            sourceStatus: unsupported ? 'unsupported' : 'unavailable',
            sourceError,
          });
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
  });
}

export const useSongSearchStore = createSongSearchStore({
  getActiveTabId: getActiveYouTubeTabId,
  getSnapshot: (tabId) =>
    sendYouTubeMessage(tabId, { type: YOUTUBE_MESSAGE.GET_SNAPSHOT }),
});
