import { Controller, Get, Param, Query } from '@nestjs/common';
import { GeniusIdParamsDto } from '../genius-id-params.dto';
import { PaginationQueryDto } from '../pagination-query.dto';
import { AlbumsService } from './albums.service';
import type { AlbumTracksResponse } from './types/album-tracks-response';

@Controller('albums')
export class AlbumsController {
  constructor(private readonly albums: AlbumsService) {}

  @Get(':id/tracks')
  tracks(
    @Param() params: GeniusIdParamsDto,
    @Query() query: PaginationQueryDto,
  ): Promise<AlbumTracksResponse> {
    return this.albums.tracks(params.id, query);
  }
}
