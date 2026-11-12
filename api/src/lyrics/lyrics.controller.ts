import { Controller, Get, Query } from '@nestjs/common';
import { LyricsService } from './lyrics.service';
import { SearchLyricsQueryDto } from './dto/search-lyrics-query.dto';
import type { LyricsSearchResponse } from './types/lyrics-search-response';

@Controller('lyrics')
export class LyricsController {
  constructor(private readonly lyrics: LyricsService) {}

  @Get('search')
  search(@Query() query: SearchLyricsQueryDto): Promise<LyricsSearchResponse> {
    return this.lyrics.search({
      title: query.title,
      artist: query.artist,
      album: query.album ?? null,
      duration: query.duration ?? null,
    });
  }
}
