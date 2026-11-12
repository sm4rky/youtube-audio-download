import type { Pagination } from '../../pagination';
import type { SongSummary } from '../../songs/types/song-summary';

export interface AlbumTracksResponse {
  albumId: number;
  pagination: Pagination;
  items: {
    trackNumber: number | null;
    discNumber: number | null;
    song: SongSummary;
  }[];
}
