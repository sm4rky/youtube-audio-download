import { Injectable } from '@nestjs/common';
import { GeniusService } from '../genius/genius.service';
import type { PaginationQueryDto } from '../pagination-query.dto';
import type { AlbumTracksResponse } from './types/album-tracks-response';
import { mapAlbumTracksResponse } from './mappers/album-tracks.mapper';

@Injectable()
export class AlbumsService {
  constructor(private readonly genius: GeniusService) {}

  async tracks(
    id: number,
    query: PaginationQueryDto,
  ): Promise<AlbumTracksResponse> {
    const result = await this.genius.getAlbumTracks(
      id,
      query.page,
      query.perPage,
    );
    return mapAlbumTracksResponse(id, query, result);
  }
}
