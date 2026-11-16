import type {
  PopupToContentMessage,
  YouTubeContentResponse,
  YouTubePlaybackMessage,
} from '../types/youtube.ts';

export const YOUTUBE_PLAYBACK_PORT = 'audiomint-playback';

export function isYouTubePlaybackMessage(
  value: unknown,
): value is YouTubePlaybackMessage {
  return (
    isRecord(value) &&
    (value.videoId === null || typeof value.videoId === 'string') &&
    typeof value.available === 'boolean' &&
    isYouTubeContentResponse(value.response)
  );
}

export const YOUTUBE_MESSAGE = {
  GET_SNAPSHOT: 'youtube/get-snapshot',
  SEEK_TO: 'youtube/seek-to',
  SEEK_BY: 'youtube/seek-by',
  PAUSE: 'youtube/pause',
  RESUME: 'youtube/resume',
} as const satisfies Record<string, PopupToContentMessage['type']>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isPopupToContentMessage(
  value: unknown,
): value is PopupToContentMessage {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case YOUTUBE_MESSAGE.GET_SNAPSHOT:
    case YOUTUBE_MESSAGE.PAUSE:
    case YOUTUBE_MESSAGE.RESUME:
      return true;
    case YOUTUBE_MESSAGE.SEEK_TO:
      return (
        typeof value.timeMs === 'number' &&
        Number.isFinite(value.timeMs) &&
        value.timeMs >= 0
      );
    case YOUTUBE_MESSAGE.SEEK_BY:
      return (
        typeof value.deltaMs === 'number' && Number.isFinite(value.deltaMs)
      );
    default:
      return false;
  }
}

export function isYouTubeContentResponse(
  value: unknown,
): value is YouTubeContentResponse {
  if (!isRecord(value)) return false;
  if (value.ok === false) {
    if (!isRecord(value.error)) return false;
    return (
      typeof value.error.code === 'string' &&
      [
        'PLAYER_UNAVAILABLE',
        'INVALID_COMMAND',
        'INVALID_SEEK',
        'PLAYBACK_FAILED',
      ].includes(value.error.code) &&
      typeof value.error.message === 'string'
    );
  }
  if (value.ok !== true || !isRecord(value.snapshot)) return false;
  const snapshot = value.snapshot;
  return (
    (snapshot.videoId === null || typeof snapshot.videoId === 'string') &&
    typeof snapshot.title === 'string' &&
    typeof snapshot.currentTimeMs === 'number' &&
    Number.isSafeInteger(snapshot.currentTimeMs) &&
    snapshot.currentTimeMs >= 0 &&
    (snapshot.durationMs === null ||
      (typeof snapshot.durationMs === 'number' &&
        Number.isSafeInteger(snapshot.durationMs) &&
        snapshot.durationMs >= 0)) &&
    typeof snapshot.paused === 'boolean' &&
    typeof snapshot.playbackRate === 'number' &&
    Number.isFinite(snapshot.playbackRate) &&
    snapshot.playbackRate > 0
  );
}
