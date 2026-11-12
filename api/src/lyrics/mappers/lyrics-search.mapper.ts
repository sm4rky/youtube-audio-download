import type { LrclibRecord } from '../../lrclib/types/lrclib-record';
import type {
  LyricsSearchCriteria,
  LyricsSearchResponse,
} from '../types/lyrics-search-response';

export function mapLyricsSearchResponse(
  query: LyricsSearchCriteria,
  selected: LrclibRecord | null,
): LyricsSearchResponse {
  return {
    query: { ...query },
    lyrics:
      selected === null
        ? null
        : {
            lrclibId: selected.id,
            trackName: selected.trackName,
            artistName: selected.artistName,
            albumName: selected.albumName,
            duration: selected.duration,
            instrumental: selected.instrumental,
            plainLyrics: selected.plainLyrics,
            syncedLyrics: selected.syncedLyrics,
          },
  };
}
