import type { YouTubeVideoSnapshot, PopupToContentMessage } from './youtube.ts';

export interface PlaybackState {
  snapshot: YouTubeVideoSnapshot | null;
  available: boolean;
}

export interface PlaybackConnection {
  command(message: PopupToContentMessage): Promise<void>;
  dispose(): void;
}

export interface PlaybackControls extends PlaybackState {
  command(message: PopupToContentMessage): Promise<void> | undefined;
}
