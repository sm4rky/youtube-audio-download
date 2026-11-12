import { Injectable } from '@nestjs/common';
import { LrclibService } from '../lrclib/lrclib.service';
import { selectBestLyricsMatch } from './matchers/lyrics.matcher';
import { mapLyricsSearchResponse } from './mappers/lyrics-search.mapper';
import type {
  LyricsSearchCriteria,
  LyricsSearchResponse,
} from './types/lyrics-search-response';

@Injectable()
export class LyricsService {
  constructor(private readonly lrclib: LrclibService) {}

  async search(criteria: LyricsSearchCriteria): Promise<LyricsSearchResponse> {
    // Album stays a soft matching signal so incomplete upstream album metadata
    // cannot filter out the recording before local selection.
    const candidates = await this.lrclib.search(
      criteria.title,
      criteria.artist,
    );
    return mapLyricsSearchResponse(
      criteria,
      selectBestLyricsMatch(candidates, criteria),
    );
  }
}
