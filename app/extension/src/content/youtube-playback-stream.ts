import {
  createYouTubePlayerBridge,
  getYouTubePlayerState,
} from './youtube-player-bridge.ts';
import { YOUTUBE_PLAYBACK_PORT } from '../lib/youtube-messages.ts';
import type { YouTubePlaybackMessage, YouTubePlayerState } from '../types/youtube.ts';

const PLAYER_EVENTS = [
  'timeupdate', 'play', 'pause', 'seeked',
  'durationchange', 'ratechange', 'loadedmetadata', 'emptied',
];
const PLAYER_CHECK_INTERVAL_MS = 500;

export function installPlaybackStream(): void {
  chrome.runtime.onConnect?.addListener((port) => {
    if (port.name !== YOUTUBE_PLAYBACK_PORT || port.sender?.id !== chrome.runtime.id) {
      return;
    }

    const bridge = createYouTubePlayerBridge();
    let stopped = false;
    let previousUrl = '';
    let previousState: YouTubePlayerState | undefined;

    function stop(): void {
      stopped = true;
      clearInterval(timer);
      for (const event of PLAYER_EVENTS) {
        document.removeEventListener(event, onMediaEvent, true);
      }
      document.removeEventListener('yt-navigate-finish', onNavigation);
    }

    function publish(message: YouTubePlaybackMessage): void {
      try {
        port.postMessage(message);
      } catch {
        stop();
      }
    }

    function emit(state = getYouTubePlayerState()): void {
      if (stopped) return;
      previousUrl = window.location.href;
      previousState = state;

      let message: YouTubePlaybackMessage;
      try {
        message = {
          videoId: state.videoId,
          available: state.available,
          response: { ok: true, snapshot: bridge.getSnapshot() },
        };
      } catch {
        message = {
          videoId: state.videoId,
          available: false,
          response: {
            ok: false,
            error: {
              code: 'PLAYER_UNAVAILABLE',
              message: 'Player temporarily unavailable.',
            },
          },
        };
      }
      publish(message);
    }

    function onMediaEvent(event: Event): void {
      if (event.target instanceof HTMLVideoElement) emit();
    }

    function onNavigation(): void {
      emit();
    }

    for (const event of PLAYER_EVENTS) {
      document.addEventListener(event, onMediaEvent, true);
    }
    document.addEventListener('yt-navigate-finish', onNavigation);

    // The clock comes from media events. This check detects URL/media replacement.
    const timer = setInterval(() => {
      const state = getYouTubePlayerState();
      if (
        window.location.href !== previousUrl ||
        state.video !== previousState?.video ||
        state.available !== previousState?.available
      ) {
        emit(state);
      }
    }, PLAYER_CHECK_INTERVAL_MS);

    port.onDisconnect.addListener(stop);
    emit();
  });
}
