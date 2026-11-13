import {
  isPopupToContentMessage,
  YOUTUBE_MESSAGE,
} from '../lib/youtube/messages.ts';
import {
  createYouTubePlayerBridge,
  YouTubePlayerError,
} from '../lib/youtube/player-bridge.ts';
import type { YouTubeContentResponse } from '../types/youtube.ts';

export function installYouTubeContentListener(): void {
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
