import type { GeniusSongSummary } from './genius-song-summary';

export interface GeniusAlbumTrack {
  disc_track_number: number | null;
  disc_number: number | null;
  song: GeniusSongSummary;
}

export interface GeniusAlbumTracks {
  tracks: GeniusAlbumTrack[];
  next_page: number | null;
}
