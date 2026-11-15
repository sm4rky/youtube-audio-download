import type { YouTubeContentResponse } from './youtube.ts';

export interface SongSearchState {
  videoId: string | null;
  sourceStatus: 'idle' | 'loading' | 'ready' | 'unsupported' | 'unavailable';
  sourceError: string | null;
  title: string;
  automaticQuery: string;
  query: string;
  validationError: string | null;
}

export interface SongSearchDependencies {
  getActiveTab(): Promise<{ tabId: number; videoId: string }>;
  getSnapshot(tabId: number): Promise<YouTubeContentResponse>;
}

export interface SongSearchStore extends SongSearchState {
  initialize(options?: { restore?: boolean }): Promise<void>;
  submit(value: string): void;
  dispose(): void;
}
