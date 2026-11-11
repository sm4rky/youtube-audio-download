import { Controller, Get, Param, Query } from '@nestjs/common';
import { SearchSongsQueryDto } from './dto/search-songs-query.dto';
import { SongsService } from './songs.service';
import type { SongSearchResponse } from './types/song-search-response';
import type { SongDetailResponse } from './types/song-detail-response';
import { SongIdParamsDto } from './dto/song-id-params.dto';

@Controller('songs')
export class SongsController {
  constructor(private readonly songs: SongsService) {}

  @Get('search')
  search(@Query() query: SearchSongsQueryDto): Promise<SongSearchResponse> {
    return this.songs.search(query.q);
  }

  @Get(':id')
  getDetail(@Param() params: SongIdParamsDto): Promise<SongDetailResponse> {
    return this.songs.getDetail(params.id);
  }
}
