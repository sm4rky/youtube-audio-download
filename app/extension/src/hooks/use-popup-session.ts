import { useEffect, useState } from 'react';
import { useIsRestoring, useQueryClient } from '@tanstack/react-query';
import { useNavigationStore } from '../stores/navigation.store.ts';
import { useSelectedSongStore } from '../stores/selected-song.store.ts';
import { useSongSearchStore } from '../stores/song-search.store.ts';
import type { PopupSession } from '../types/popup-session.ts';

// Restore the session and verify the video when the popup opens or the user retries.
// The root provider restores query cache before this hook verifies the source session.
export function usePopupSession(): PopupSession {
  const queryClient = useQueryClient();
  const restoring = useIsRestoring();
  // App can display session content once the stores and video have been verified.
  const [initialized, setInitialized] = useState(false);
  // Changing this value reruns the initialization effect on retry.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Wait for restoration so a later restore cannot reintroduce a previous video's cache.
    if (restoring) return;
    let active = true;

    async function initialize() {
      // Restore the search context, current view and selected song from session storage.
      await Promise.all([
        useSongSearchStore.persist.rehydrate(),
        useNavigationStore.persist.rehydrate(),
        useSelectedSongStore.persist.rehydrate(),
      ]);
      if (!active) return;
      const previousVideo = useSongSearchStore.getState().videoId;
      await useSongSearchStore.getState().initialize({ restore: true });
      if (!active) return;
      const source = useSongSearchStore.getState();
      // A new video starts a fresh search session and clears the previous selection.
      if (source.videoId !== previousVideo) {
        queryClient.clear();
        useSelectedSongStore.getState().selectSong(null);
        useNavigationStore.getState().setView('loading');
      }
      // A restored Details view requires a selected song.
      if (
        useNavigationStore.getState().view === 'song-details' &&
        useSelectedSongStore.getState().selectedSongId === null
      ) {
        useNavigationStore.getState().setView('search-results');
      }
      setInitialized(true);
    }

    void initialize();
    return () => {
      // Prevent stale initialization from updating the session after unmount or retry.
      active = false;
      useSongSearchStore.getState().dispose();
    };
  }, [attempt, queryClient, restoring]);

  function retrySource() {
    setInitialized(false);
    setAttempt((value) => value + 1);
  }

  return { initialized, retrySource };
}
