import { Controller, Get, Query } from '@nestjs/common';
import { SearchSongsQueryDto } from './dto/search-songs-query.dto';
import { SongsService } from './songs.service';

@Controller('songs')
export class SongsController {
  constructor(private readonly songs: SongsService) {}

  @Get('search')
  search(@Query() query: SearchSongsQueryDto) {
    return this.songs.search(query.q);
  }
}
