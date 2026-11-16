import { YouTubePlayerError } from '../errors/youtube-player.error.ts';
import type {
  YouTubePlayerBridge,
  YouTubePlayerState,
} from '../types/youtube.ts';

function findVideo(): HTMLVideoElement | null {
  // Resolve for each operation because YouTube can replace the element in-place.
  const video =
    document.querySelector('#movie_player video.html5-main-video') ??
    document.querySelector('video');
  return video instanceof HTMLVideoElement ? video : null;
}

function getVideo(): HTMLVideoElement {
  const video = findVideo();
  if (!video) {
    throw new YouTubePlayerError(
      'PLAYER_UNAVAILABLE',
      'YouTube player is unavailable.',
    );
  }
  return video;
}

export function getYouTubePlayerState(): YouTubePlayerState {
  const video = findVideo();
  const adPlaying = Boolean(
    document.querySelector('#movie_player.ad-showing, #movie_player.ad-interrupting'),
  );
  return {
    video,
    videoId: getVideoId(),
    adPlaying,
    available: video !== null && video.readyState >= 1 && !adPlaying,
  };
}

function getVideoId(): string | null {
  const url = new URL(window.location.href);
  if (url.origin !== 'https://www.youtube.com' || url.pathname !== '/watch')
    return null;
  return url.searchParams.get('v')?.trim() || null;
}

function getTitle(): string {
  const heading = document
    .querySelector(
      'ytd-watch-metadata h1 yt-formatted-string, h1.title yt-formatted-string',
    )
    ?.textContent?.trim();
  const meta = document
    .querySelector('meta[name="title"]')
    ?.getAttribute('content')
    ?.trim();
  return heading || meta || document.title.trim();
}

function durationMs(video: HTMLVideoElement): number | null {
  const milliseconds = Math.round(video.duration * 1000);
  return Number.isSafeInteger(milliseconds) && milliseconds >= 0
    ? milliseconds
    : null;
}

export function createYouTubePlayerBridge(): YouTubePlayerBridge {
  return {
    getSnapshot() {
      const video = getVideo();
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
      if (canonical && new URL(canonical, window.location.href).searchParams.get('v') !== getVideoId()) {
        throw new YouTubePlayerError('PLAYER_UNAVAILABLE', 'The new video metadata is still loading.');
      }
      const currentTimeMs = Math.round(video.currentTime * 1000);
      return {
        videoId: getVideoId(),
        title: getTitle(),
        currentTimeMs:
          Number.isSafeInteger(currentTimeMs) && currentTimeMs >= 0
            ? currentTimeMs
            : 0,
        durationMs: durationMs(video),
        paused: video.paused,
        playbackRate:
          Number.isFinite(video.playbackRate) && video.playbackRate > 0
            ? video.playbackRate
            : 1,
      };
    },
    seekTo(timeMs) {
      const video = getVideo();
      if (
        !Number.isFinite(timeMs) ||
        timeMs < 0 ||
        (Number.isFinite(video.duration) && timeMs / 1000 > video.duration)
      ) {
        throw new YouTubePlayerError(
          'INVALID_SEEK',
          'Seek target is outside the video timeline.',
        );
      }
      try {
        video.currentTime = timeMs / 1000;
      } catch {
        throw new YouTubePlayerError(
          'INVALID_SEEK',
          'The player cannot seek to that time.',
        );
      }
    },
    seekBy(deltaMs) {
      if (!Number.isFinite(deltaMs)) {
        throw new YouTubePlayerError(
          'INVALID_SEEK',
          'Seek offset must be finite.',
        );
      }
      const video = getVideo();
      const limit = Number.isFinite(video.duration)
        ? video.duration * 1000
        : Infinity;
      const timeMs = Math.min(limit, Math.max(0, video.currentTime * 1000 + deltaMs));
      if (
        !Number.isFinite(timeMs) ||
        timeMs < 0 ||
        (Number.isFinite(video.duration) && timeMs / 1000 > video.duration)
      ) {
        throw new YouTubePlayerError(
          'INVALID_SEEK',
          'Seek target is outside the video timeline.',
        );
      }
      try {
        video.currentTime = timeMs / 1000;
      } catch {
        throw new YouTubePlayerError(
          'INVALID_SEEK',
          'The player cannot seek to that time.',
        );
      }
    },
    pause() {
      getVideo().pause();
    },
    async resume() {
      try {
        await getVideo().play();
      } catch (error: unknown) {
        if (error instanceof YouTubePlayerError) throw error;
        throw new YouTubePlayerError(
          'PLAYBACK_FAILED',
          'YouTube could not resume playback.',
        );
      }
    },
  };
}
