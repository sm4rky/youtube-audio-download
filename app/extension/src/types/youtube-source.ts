import type { YouTubeContentResponse } from './youtube.ts';

export interface YouTubeSourceContext {
  videoId: string | null;
  title: string;
  automaticQuery: string;
  query: string;
}

export interface YouTubeSourceUpdate {
  videoId?: string | null;
  title?: string;
  automaticQuery?: string;
  query?: string;
  sourceStatus: 'loading' | 'ready' | 'unsupported' | 'unavailable';
  sourceError?: string;
}

export interface YouTubeSourceDependencies {
  getActiveTab(): Promise<{ tabId: number; videoId: string }>;
  getSnapshot(tabId: number): Promise<YouTubeContentResponse>;
}
