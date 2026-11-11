import { Injectable } from '@nestjs/common';
import { GeniusService } from '../genius/genius.service';
import { mapSongSearchResponse } from './mappers/song-search.mapper';
import { mapSongDetailResponse } from './mappers/song-detail.mapper';
import type { SongSearchResponse } from './types/song-search-response';
import type { SongDetailResponse } from './types/song-detail-response';

@Injectable()
export class SongsService {
  constructor(private readonly genius: GeniusService) {}

  async search(query: string): Promise<SongSearchResponse> {
    return mapSongSearchResponse(query, await this.genius.search(query));
  }

  async getDetail(id: number): Promise<SongDetailResponse> {
    return mapSongDetailResponse(await this.genius.getDetail(id));
  }
}
