import { useYouTubePlayback } from '../hooks/use-youtube-playback.ts';
import { useSelectedSongStore } from '../stores/selected-song.store.ts';
import { useEffect } from 'react';
import { useIsRestoring, useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CircleAlert, CirclePlay, MonitorPlay } from 'lucide-react';
import { SongDetailsScreen } from '../screens/song-details-screen.tsx';
import { LoadingScreen } from '../screens/loading-screen.tsx';
import { SearchResultsScreen } from '../screens/search-results-screen.tsx';
import { ErrorScreen } from '../screens/error-screen.tsx';
import { songSearchOptions } from '../queries/songs.queries.ts';
import { useNavigationStore } from '../stores/navigation.store.ts';
import { useSongSearchStore } from '../stores/song-search.store.ts';

export function ViewResolver({ onRetrySource }: { onRetrySource(): void }) {
  const view = useNavigationStore((state) => state.view);
  const setView = useNavigationStore((state) => state.setView);
  const query = useSongSearchStore((state) => state.query);
  const sourceStatus = useSongSearchStore((state) => state.sourceStatus);
  const sourceError = useSongSearchStore((state) => state.sourceError);
  const restoring = useIsRestoring();
  const reduceMotion = useReducedMotion();
  const videoId = useSongSearchStore((state) => state.videoId);
  const playback = useYouTubePlayback(!restoring && sourceStatus === 'ready' ? videoId : null, () => {
    useSelectedSongStore.getState().selectSong(null);
    setView('loading');
    onRetrySource();
  });
  const options = songSearchOptions(query);
  const search = useQuery({
    ...options,
    enabled: options.enabled && sourceStatus === 'ready' && !restoring && view !== 'song-details',
  });

  useEffect(() => {
    if (view === 'loading' && !restoring && sourceStatus === 'ready' &&
      (search.status === 'success' || search.status === 'error')) {
      setView('search-results');
    }
  }, [view, restoring, sourceStatus, search.status, setView]);

  // Session hydration is not a new search. Keep the layout until the cache is ready.
  if (restoring) return null;

  if (sourceError) {
    const unsupported = sourceStatus === 'unsupported';
    return (
      <ErrorScreen
        icon={unsupported ? CirclePlay : MonitorPlay}
        title={unsupported ? 'Open a YouTube video' : 'Can’t read this video'}
        description={unsupported ? 'Choose a video on YouTube, then try again.' : sourceError}
        retryLabel="Retry reading video"
        onRetry={onRetrySource}
      />
    );
  }

  if (view !== 'song-details' && !restoring && search.isError && !search.isFetching) {
    return (
      <ErrorScreen
        icon={CircleAlert}
        title="Search is unavailable"
        description="We couldn’t complete the search. Please try again."
        retryLabel="Retry search"
        onRetry={() => { void search.refetch(); }}
      />
    );
  }

  const displayedView = view;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={displayedView}
        className="flex min-h-0 flex-1 flex-col motion-reduce:transform-none!"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
      >
        {displayedView === 'song-details' ? <SongDetailsScreen playback={playback} /> : displayedView === 'loading' ? <LoadingScreen /> : (
          <SearchResultsScreen
            items={search.data?.items}
            pending={search.isPending}
            fetching={search.isFetching}
            onRetry={() => { void search.refetch(); }}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
