import type { SongSummary } from './song-summary';

export interface SongSearchResponse {
  query: string;
  items: SongSummary[];
}
