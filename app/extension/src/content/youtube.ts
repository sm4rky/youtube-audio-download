import { YouTubePlayerError } from '../errors/youtube-player.error.ts';
import { installPlaybackStream } from './youtube-playback-stream.ts';
import {
  isPopupToContentMessage,
  YOUTUBE_MESSAGE,
} from '../lib/youtube-messages.ts';
import {
  createYouTubePlayerBridge,
  getYouTubePlayerState,
} from './youtube-player-bridge.ts';
import type { YouTubeContentResponse } from '../types/youtube.ts';

function installYouTubeContentListener(): void {
  const bridge = createYouTubePlayerBridge();
  chrome.runtime.onMessage.addListener(
    (
      message: unknown,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: YouTubeContentResponse) => void,
    ) => {
      if (
        sender.id !== chrome.runtime.id ||
        message === null ||
        typeof message !== 'object' ||
        !('type' in message) ||
        typeof message.type !== 'string' ||
        !message.type.startsWith('youtube/')
      )
        return false;

      const respondWithSnapshot = (): void => {
        sendResponse({ ok: true, snapshot: bridge.getSnapshot() });
      };
      const respondWithError = (error: unknown): void => {
        sendResponse({
          ok: false,
          error:
            error instanceof YouTubePlayerError
              ? { code: error.code, message: error.message }
              : {
                  code: 'PLAYER_UNAVAILABLE',
                  message: 'YouTube player is unavailable.',
                },
        });
      };
      if (!isPopupToContentMessage(message)) {
        sendResponse({
          ok: false,
          error: {
            code: 'INVALID_COMMAND',
            message: 'Invalid YouTube command.',
          },
        });
        return false;
      }
      try {
        if (message.type !== YOUTUBE_MESSAGE.GET_SNAPSHOT && getYouTubePlayerState().adPlaying) {
          throw new YouTubePlayerError('PLAYER_UNAVAILABLE', 'Player temporarily unavailable.');
        }
        switch (message.type) {
          case YOUTUBE_MESSAGE.GET_SNAPSHOT:
            break;
          case YOUTUBE_MESSAGE.SEEK_TO:
            bridge.seekTo(message.timeMs);
            break;
          case YOUTUBE_MESSAGE.SEEK_BY:
            bridge.seekBy(message.deltaMs);
            break;
          case YOUTUBE_MESSAGE.PAUSE:
            bridge.pause();
            break;
          case YOUTUBE_MESSAGE.RESUME:
            void bridge
              .resume()
              .then(respondWithSnapshot)
              .catch(respondWithError);
            return true;
        }
        respondWithSnapshot();
      } catch (error: unknown) {
        respondWithError(error);
      }
      return false;
    },
  );
}

installYouTubeContentListener();

installPlaybackStream();
