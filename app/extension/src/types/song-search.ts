import type { YouTubeContentResponse } from './youtube.ts';

export interface SongSearchState {
  sourceStatus: 'idle' | 'loading' | 'ready' | 'unsupported' | 'unavailable';
  sourceError: string | null;
  title: string;
  automaticQuery: string;
  query: string;
  validationError: string | null;
}

export interface SongSearchDependencies {
  getActiveTabId(): Promise<number>;
  getSnapshot(tabId: number): Promise<YouTubeContentResponse>;
}

export interface SongSearchStore extends SongSearchState {
  initialize(): Promise<void>;
  submit(value: string): void;
  dispose(): void;
}
