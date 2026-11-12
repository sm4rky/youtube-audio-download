export interface LyricsSearchCriteria {
  title: string;
  artist: string;
  album: string | null;
  duration: number | null;
}

export interface LyricsRecord {
  lrclibId: number;
  trackName: string;
  artistName: string;
  albumName: string | null;
  duration: number | null;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

export interface LyricsSearchResponse {
  query: LyricsSearchCriteria;
  lyrics: LyricsRecord | null;
}
