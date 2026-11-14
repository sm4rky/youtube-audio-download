export interface YouTubeVideoSnapshot {
  videoId: string | null;
  title: string;
  currentTimeMs: number;
  durationMs: number | null;
  paused: boolean;
  playbackRate: number;
}

export interface YouTubePlayerBridge {
  getSnapshot(): YouTubeVideoSnapshot;
  seekTo(timeMs: number): void;
  seekBy(deltaMs: number): void;
  pause(): void;
  resume(): Promise<void>;
}

export type YouTubePlayerErrorCode =
  'PLAYER_UNAVAILABLE' | 'INVALID_COMMAND' | 'INVALID_SEEK' | 'PLAYBACK_FAILED';

export type YouTubeClientErrorCode =
  | 'UNSUPPORTED_TAB'
  | 'TAB_UNAVAILABLE'
  | 'CONTENT_UNAVAILABLE'
  | 'INVALID_RESPONSE';

export type PopupToContentMessage =
  | { type: 'youtube/get-snapshot' }
  | { type: 'youtube/seek-to'; timeMs: number }
  | { type: 'youtube/seek-by'; deltaMs: number }
  | { type: 'youtube/pause' }
  | { type: 'youtube/resume' };

export type YouTubeContentResponse =
  | { ok: true; snapshot: YouTubeVideoSnapshot }
  | { ok: false; error: { code: YouTubePlayerErrorCode; message: string } };
