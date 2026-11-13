import type { Pagination } from '@/common/pagination/pagination';
import type { SongSummary } from '@/songs/types/song-summary';

export interface AlbumTrack {
  trackNumber: number | null;
  discNumber: number | null;
  song: SongSummary;
}

export interface AlbumTracksResponse {
  albumId: number;
  pagination: Pagination;
  items: AlbumTrack[];
}
