import { YouTubeClientError } from './chrome-tabs.ts';
import { normalizeTitleToQuery } from './song-title-normalizer.ts';
import type { SongSearchDependencies } from '../types/song-search.ts';
import type { YouTubeSourceContext, YouTubeSourceUpdate } from '../types/youtube-source.ts';

// Yield the confirmed identity before reading the player so stale context is cleared
// even when the player fails. The caller can stop between steps when disposed.
export async function* readYouTubeSource(
  dependencies: SongSearchDependencies,
  previous: YouTubeSourceContext,
  restore = false,
): AsyncGenerator<YouTubeSourceUpdate, void, void> {
  try {
    const { tabId, videoId } = await dependencies.getActiveTab();
    const sameVideo = previous.videoId === videoId;
    yield sameVideo
      ? { sourceStatus: 'loading' }
      : { videoId, title: '', automaticQuery: '', query: '', sourceStatus: 'loading' };
    // A saved search needs a verified video identity, not another player read.
    if (restore && sameVideo && previous.title.trim() && previous.query) {
      yield { sourceStatus: 'ready' };
      return;
    }
    const response = await dependencies.getSnapshot(tabId);
    if (!response.ok) {
      yield {
        sourceStatus: 'unavailable',
        sourceError:
          'The YouTube player is not ready. Let the video load and retry.',
      };
      return;
    }
    if (response.snapshot.videoId !== videoId) {
      yield {
        sourceStatus: 'unavailable',
        sourceError: 'The video changed while reading the player. Please retry.',
      };
      return;
    }
    const title = response.snapshot.title;
    const query = normalizeTitleToQuery(title);
    if (!query) {
      yield {
        sourceStatus: 'unavailable',
        sourceError:
          'The video title is not ready. Let the page load and retry.',
      };
      return;
    }
    yield {
      videoId: response.snapshot.videoId,
      sourceStatus: 'ready',
      title,
      automaticQuery: query,
      query: sameVideo && previous.query ? previous.query : query,
    };
  } catch (error: unknown) {
    const unsupported =
      error instanceof YouTubeClientError &&
      error.code === 'UNSUPPORTED_TAB';
    let sourceError =
      'Cannot read the YouTube video. Reload the tab if needed, then retry.';
    if (error instanceof YouTubeClientError) sourceError = error.message;
    if (unsupported)
      sourceError = 'Open a YouTube watch video, then retry.';
    yield {
      sourceStatus: unsupported ? 'unsupported' : 'unavailable',
      sourceError,
    };
  }
}
