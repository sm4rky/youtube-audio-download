import type { z } from 'zod';
import type { songDraftSchema, songDraftValuesSchema } from '../schemas/song-draft.schema.ts';
import type { SongDetail } from './song.ts';
import type { LyricsRecord } from './lyrics.ts';

export type SongDraft = z.infer<typeof songDraftSchema>;
export type SongDraftValues = z.infer<typeof songDraftValuesSchema>;

export interface SongDraftIdentity {
  videoId: string;
  geniusId: number;
}

export interface SongDraftSeed {
  videoId: string;
  song: SongDetail;
  lyrics: LyricsRecord | null;
}

export interface SongDraftState {
  draft: SongDraft | null;
}

export interface SongDraftStore extends SongDraftState {
  initializeDraft(seed: SongDraftSeed): void;
  updateDraft(identity: SongDraftIdentity, changes: Partial<SongDraftValues>): void;
  clearDraft(): void;
}
