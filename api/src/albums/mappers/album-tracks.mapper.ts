import type { GeniusAlbumTracks } from '@/genius/types/genius-album-tracks';
import type { PaginationCriteria } from '@/common/pagination/pagination';
import type { AlbumTracksResponse } from '../types/album-tracks-response';
import { mapSongSummary } from '@/songs/mappers/song-summary.mapper';

export function mapAlbumTracksResponse(
  id: number,
  criteria: PaginationCriteria,
  result: GeniusAlbumTracks,
): AlbumTracksResponse {
  return {
    albumId: id,
    pagination: {
      page: criteria.page,
      perPage: criteria.perPage,
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
