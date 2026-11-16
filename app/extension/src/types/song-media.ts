import type { SyncedLyricLine } from './lyrics.ts';

export interface SyncedLyricsProps {
  lines: readonly SyncedLyricLine[];
  currentTimeMs: number;
}

export interface SongMediaProps extends SyncedLyricsProps {
  title: string;
  coverUrl: string | null;
}
