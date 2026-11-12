import { Injectable } from '@nestjs/common';
import { GeniusService } from '../genius/genius.service';
import type { ArtistSongsQueryDto } from './dto/artist-songs-query.dto';
import type { ArtistSongsResponse } from './types/artist-songs-response';
import { mapArtistSongsResponse } from './mappers/artist-songs.mapper';

@Injectable()
export class ArtistsService {
  constructor(private readonly genius: GeniusService) {}

  async songs(
    id: number,
    query: ArtistSongsQueryDto,
  ): Promise<ArtistSongsResponse> {
    const result = await this.genius.getArtistSongs(
      id,
      query.page,
      query.perPage,
      query.sort,
    );
    return mapArtistSongsResponse(id, query, result);
  }
}
