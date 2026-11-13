import { Injectable } from '@nestjs/common';
import { GeniusService } from '@/genius/genius.service';
import type { PaginationCriteria } from '@/common/pagination/pagination';
import type { AlbumTracksResponse } from './types/album-tracks-response';
import { mapAlbumTracksResponse } from './mappers/album-tracks.mapper';

@Injectable()
export class AlbumsService {
  constructor(private readonly genius: GeniusService) {}

  async listTracks(
    id: number,
    criteria: PaginationCriteria,
  ): Promise<AlbumTracksResponse> {
    const result = await this.genius.getAlbumTracks(
      id,
      criteria.page,
      criteria.perPage,
    );
    return mapAlbumTracksResponse(id, criteria, result);
  }
}
