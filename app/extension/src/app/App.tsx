import { useEffect, useState } from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { PopupLayout } from '../layouts/popup-layout.tsx';
import { useSongSearchStore } from '../stores/song-search.store.ts';
import { useNavigationStore } from '../stores/navigation.store.ts';
import { searchCacheOptions } from '../storage/query-cache-persister.ts';
import { queryClient } from './query-client.ts';
import { ViewResolver } from './view-resolver.tsx';

export default function App() {
  const [initialized, setInitialized] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const videoId = useSongSearchStore((state) => state.videoId);

  useEffect(() => {
    let active = true;
    async function initialize() {
      await Promise.all([
        useSongSearchStore.persist.rehydrate(),
        useNavigationStore.persist.rehydrate(),
      ]);
      if (!active) return;
      const previousVideo = useSongSearchStore.getState().videoId;
      queryClient.clear();
      await useSongSearchStore.getState().initialize({ restore: true });
      if (!active) return;
      const source = useSongSearchStore.getState();
      if (source.videoId !== previousVideo) {
        useNavigationStore.getState().setView('loading');
      }
      setInitialized(true);
    }
    void initialize();
    return () => {
      active = false;
      useSongSearchStore.getState().dispose();
    };
  }, [attempt]);

  function retrySource() {
    setInitialized(false);
    setAttempt((value) => value + 1);
  }

  return (
    <PopupLayout>
      {initialized ? (
        <PersistQueryClientProvider
          key={videoId}
          client={queryClient}
          persistOptions={searchCacheOptions(videoId)}
        >
          <ViewResolver onRetrySource={retrySource} />
        </PersistQueryClientProvider>
      ) : null}
    </PopupLayout>
  );
}
