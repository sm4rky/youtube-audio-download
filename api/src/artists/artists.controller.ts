import { Controller, Get, Param, Query } from '@nestjs/common';
import { GeniusIdParamsDto } from '@/common/http/genius-id-params.dto';
import { ArtistSongsQueryDto } from './dto/artist-songs-query.dto';
import { ArtistsService } from './artists.service';
import type { ArtistSongsResponse } from './types/artist-songs-response';

@Controller('artists')
export class ArtistsController {
  constructor(private readonly artists: ArtistsService) {}

  @Get(':id/songs')
  listSongs(
    @Param() params: GeniusIdParamsDto,
    @Query() query: ArtistSongsQueryDto,
  ): Promise<ArtistSongsResponse> {
    return this.artists.listSongs(params.id, {
      page: query.page,
      perPage: query.perPage,
      sort: query.sort,
    });
  }
}
