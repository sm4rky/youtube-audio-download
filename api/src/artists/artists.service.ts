import { Injectable } from '@nestjs/common';
import { GeniusService } from '@/genius/genius.service';
import type { ArtistSongsCriteria } from './types/artist-songs-criteria';
import type { ArtistSongsResponse } from './types/artist-songs-response';
import { mapArtistSongsResponse } from './mappers/artist-songs.mapper';

@Injectable()
export class ArtistsService {
  constructor(private readonly genius: GeniusService) {}

  async listSongs(
    id: number,
    criteria: ArtistSongsCriteria,
  ): Promise<ArtistSongsResponse> {
    const result = await this.genius.getArtistSongs(
      id,
      criteria.page,
      criteria.perPage,
      criteria.sort,
    );
    return mapArtistSongsResponse(id, criteria, result);
  }
}
