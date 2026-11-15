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
