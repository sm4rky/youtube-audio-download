import { Controller, Get, Param, Query } from '@nestjs/common';
import { GeniusIdParamsDto } from '@/common/http/genius-id-params.dto';
import { PaginationQueryDto } from '@/common/http/pagination-query.dto';
import { AlbumsService } from './albums.service';
import type { AlbumTracksResponse } from './types/album-tracks-response';

@Controller('albums')
export class AlbumsController {
  constructor(private readonly albums: AlbumsService) {}

  @Get(':id/tracks')
  listTracks(
    @Param() params: GeniusIdParamsDto,
    @Query() query: PaginationQueryDto,
  ): Promise<AlbumTracksResponse> {
    return this.albums.listTracks(params.id, {
      page: query.page,
      perPage: query.perPage,
    });
  }
}
