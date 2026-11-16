import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { songDetailOptions } from '../queries/songs.queries.ts';
import { lyricsSearchOptions } from '../queries/lyrics.queries.ts';
import { lyricsCriteriaSchema } from '../schemas/lyrics.schema.ts';
import { parseSyncedLyrics } from '../lib/synced-lyrics.ts';
import { useSelectedSongStore } from '../stores/selected-song.store.ts';
import { useSongSearchStore } from '../stores/song-search.store.ts';
import { useSongDraftStore } from '../stores/song-draft.store.ts';
import type { PlaybackControls } from '../types/playback.ts';
import type { LyricsCriteria } from '../types/lyrics.ts';
import type { SongDetail } from '../types/song.ts';

// Genius supplies metadata. The current YouTube snapshot supplies duration in milliseconds.
export function getLyricsCriteria(
  song: SongDetail | undefined,
  durationMs: number | null,
): LyricsCriteria | null {
  const result = lyricsCriteriaSchema.safeParse({
    title: song?.title,
    artist: song?.primaryArtists[0]?.name,
    album: song?.album?.title,
    duration: durationMs !== null && durationMs > 0 ? durationMs / 1000 : undefined,
  });
  return result.success ? result.data : null;
}

// Detail must succeed before deriving the dependent lyrics request or seeding a draft.
export function useSongDetails(playback: PlaybackControls) {
  const selectedId = useSelectedSongStore((state) => state.selectedSongId);
  const videoId = useSongSearchStore((state) => state.videoId);
  const draft = useSongDraftStore((state) => state.draft);
  const detail = useQuery(songDetailOptions(selectedId));
  const durationMs = playback.snapshot?.durationMs ?? null;
  const criteria = useMemo(() => (
    detail.isSuccess && playback.initialized
      ? getLyricsCriteria(detail.data, durationMs)
      : null
  ), [detail.isSuccess, detail.data, playback.initialized, durationMs]);
  const lyrics = useQuery(lyricsSearchOptions(criteria));
  const pending = detail.isPending || (detail.isSuccess && (
    !playback.initialized || (criteria !== null && lyrics.isPending)
  ));

  useEffect(() => {
    if (pending || !detail.isSuccess || !videoId || detail.data.geniusId !== selectedId) return;
    // A request completed for a previous selection must not seed the next session.
    if (
      useSongSearchStore.getState().videoId !== videoId ||
      useSelectedSongStore.getState().selectedSongId !== selectedId
    ) return;
    useSongDraftStore.getState().initializeDraft({
      videoId,
      song: detail.data,
      lyrics: criteria !== null && lyrics.isSuccess ? lyrics.data.lyrics : null,
    });
  }, [pending, detail.isSuccess, detail.data, videoId, selectedId, criteria, lyrics.isSuccess, lyrics.data]);

  const currentDraft = draft?.videoId === videoId && draft.geniusId === selectedId ? draft : null;
  const syncedLyrics = currentDraft?.current.syncedLyrics ?? null;
  const lines = useMemo(() => parseSyncedLyrics(syncedLyrics), [syncedLyrics]);
  return {
    selectedId,
    detail,
    draft: currentDraft,
    lines,
    pending: pending || (detail.isSuccess && currentDraft === null),
    lyricsUnavailable: lyrics.isError || (detail.isSuccess && playback.initialized && criteria === null),
  };
}
