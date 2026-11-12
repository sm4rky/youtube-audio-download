import type { GeniusAlbumTracks } from '../../genius/types/genius-album-tracks';
import type { PaginationQueryDto } from '../../pagination-query.dto';
import type { AlbumTracksResponse } from '../types/album-tracks-response';
import { mapSongSummary } from '../../songs/mappers/song-summary.mapper';

export function mapAlbumTracksResponse(
  id: number,
  query: PaginationQueryDto,
  result: GeniusAlbumTracks,
): AlbumTracksResponse {
  return {
    albumId: id,
    pagination: {
      page: query.page,
      perPage: query.perPage,
      nextPage: result.next_page,
      hasMore: result.next_page !== null,
    },
    items: result.tracks.map((track) => ({
      trackNumber: track.disc_track_number,
      discNumber: track.disc_number,
      song: mapSongSummary(track.song),
    })),
  };
}
