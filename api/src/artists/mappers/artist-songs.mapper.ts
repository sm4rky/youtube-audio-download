import type { GeniusArtistSongs } from '../../genius/types/genius-artist-songs';
import type { ArtistSongsQueryDto } from '../dto/artist-songs-query.dto';
import type { ArtistSongsResponse } from '../types/artist-songs-response';
import { mapSongSummary } from '../../songs/mappers/song-summary.mapper';

export function mapArtistSongsResponse(
  id: number,
  query: ArtistSongsQueryDto,
  result: GeniusArtistSongs,
): ArtistSongsResponse {
  return {
    artistId: id,
    sort: query.sort,
    pagination: {
      page: query.page,
      perPage: query.perPage,
      nextPage: result.next_page,
      hasMore: result.next_page !== null,
    },
    items: result.songs.map(mapSongSummary),
  };
}
