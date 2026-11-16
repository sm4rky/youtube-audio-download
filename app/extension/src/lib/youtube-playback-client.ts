import { getActiveYouTubeTab, sendYouTubeMessage } from './youtube-client.ts';
import { isYouTubePlaybackMessage, YOUTUBE_PLAYBACK_PORT } from './youtube-messages.ts';
import type { PlaybackConnection, PlaybackState } from '../types/playback.ts';

export function connectYouTubePlayback(
  videoId: string,
  onState: (state: PlaybackState) => void,
  onVideoChanged: () => void,
): PlaybackConnection {
  let disposed = false;
  let videoChanged = false;
  let port: chrome.runtime.Port | undefined;
  let tabId: number | undefined;

  function markUnavailable(): void {
    if (!disposed && !videoChanged) {
      onState({ snapshot: null, available: false });
    }
  }

  function handleVideoChange(): void {
    if (disposed || videoChanged) return;
    videoChanged = true;
    onState({ snapshot: null, available: false });
    onVideoChanged();
  }

  function receive(message: unknown): void {
    if (disposed || videoChanged || !isYouTubePlaybackMessage(message)) return;
    if (message.videoId !== videoId) {
      handleVideoChange();
      return;
    }
    const response = message.response;
    if (response.ok && response.snapshot.videoId !== videoId) {
      handleVideoChange();
      return;
    }
    onState({
      snapshot: response.ok ? response.snapshot : null,
      available: response.ok && message.available,
    });
  }

  async function connect(): Promise<void> {
    try {
      const tab = await getActiveYouTubeTab();
      if (disposed) return;
      if (tab.videoId !== videoId) {
        handleVideoChange();
        return;
      }
      tabId = tab.tabId;
      port = chrome.tabs.connect(tabId, { name: YOUTUBE_PLAYBACK_PORT, frameId: 0 });
      port.onMessage.addListener(receive);
      port.onDisconnect.addListener(() => {
        // Reading lastError acknowledges Chrome's disconnect error.
        void chrome.runtime.lastError;
        markUnavailable();
      });
    } catch {
      markUnavailable();
    }
  }

  void connect();

  return {
    async command(message) {
      if (disposed || videoChanged || tabId === undefined) return;
      try {
        const tab = await getActiveYouTubeTab();
        if (disposed || videoChanged) return;
        if (tab.videoId !== videoId || tab.tabId !== tabId) {
          handleVideoChange();
          return;
        }
        const response = await sendYouTubeMessage(tabId, message);
        // Reconcile commands using the actual snapshot returned by the player.
        receive({ videoId, response, available: response.ok });
      } catch {
        markUnavailable();
      }
    },
    dispose() {
      disposed = true;
      port?.disconnect();
    },
  };
}
