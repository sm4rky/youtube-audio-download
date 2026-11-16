import type { YouTubeVideoSnapshot, PopupToContentMessage } from './youtube.ts';

export interface PlaybackState {
  videoId: string | null;
  snapshot: YouTubeVideoSnapshot | null;
  available: boolean;
}

export interface PlaybackConnection {
  command(message: PopupToContentMessage): Promise<void>;
  dispose(): void;
}

export interface PlaybackControls extends PlaybackState {
  initialized: boolean;
  command(message: PopupToContentMessage): Promise<void> | undefined;
}
