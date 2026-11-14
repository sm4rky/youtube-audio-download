import {
  isPopupToContentMessage,
  isYouTubeContentResponse,
} from './youtube-messages.ts';
import type {
  PopupToContentMessage,
  YouTubeClientErrorCode,
  YouTubeContentResponse,
} from '../types/youtube.ts';

export class YouTubeClientError extends Error {
  readonly code: YouTubeClientErrorCode;

  constructor(
    code: YouTubeClientErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'YouTubeClientError';
    this.code = code;
  }
}

export async function getActiveYouTubeTabId(): Promise<number> {
  let tabs: chrome.tabs.Tab[];
  try {
    tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch (error: unknown) {
    throw new YouTubeClientError(
      'TAB_UNAVAILABLE',
      'Chrome could not read the active tab. Reopen AudioMint on a YouTube watch page.',
      { cause: error },
    );
  }
  const [tab] = tabs;
  if (tab?.id === undefined || !tab.url) {
    throw new YouTubeClientError(
      'TAB_UNAVAILABLE',
      'The active tab is unavailable.',
    );
  }
  const url = new URL(tab.url);
  if (
    url.origin !== 'https://www.youtube.com' ||
    url.pathname !== '/watch' ||
    !url.searchParams.get('v')?.trim()
  ) {
    throw new YouTubeClientError(
      'UNSUPPORTED_TAB',
      'Not a supported YouTube video.',
    );
  }
  return tab.id;
}

export async function sendYouTubeMessage(
  tabId: number,
  message: PopupToContentMessage,
): Promise<YouTubeContentResponse> {
  if (
    !Number.isSafeInteger(tabId) ||
    tabId < 0 ||
    !isPopupToContentMessage(message)
  ) {
    throw new Error('Invalid YouTube request.');
  }
  let response: unknown;
  try {
    response = await chrome.tabs.sendMessage(tabId, message, { frameId: 0 });
  } catch (error: unknown) {
    throw new YouTubeClientError(
      'CONTENT_UNAVAILABLE',
      'AudioMint cannot reach the YouTube content script. Reload this YouTube tab, then retry.',
      { cause: error },
    );
  }
  if (!isYouTubeContentResponse(response)) {
    throw new YouTubeClientError(
      'INVALID_RESPONSE',
      'Invalid response from the YouTube bridge. Reload AudioMint in chrome://extensions, then reload this YouTube tab.',
    );
  }
  return response;
}
