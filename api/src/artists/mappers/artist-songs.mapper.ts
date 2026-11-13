import type { GeniusArtistSongs } from '@/genius/types/genius-artist-songs';
import type { ArtistSongsCriteria } from '../types/artist-songs-criteria';
import type { ArtistSongsResponse } from '../types/artist-songs-response';
import { mapSongSummary } from '@/songs/mappers/song-summary.mapper';

export function mapArtistSongsResponse(
  id: number,
  criteria: ArtistSongsCriteria,
  result: GeniusArtistSongs,
): ArtistSongsResponse {
  return {
    artistId: id,
    sort: criteria.sort,
    pagination: {
      page: criteria.page,
      perPage: criteria.perPage,
      nextPage: result.next_page,
      hasMore: result.next_page !== null,
    },
    items: result.songs.map(mapSongSummary),
  };
}
