import {
  isPopupToContentMessage,
  isYouTubeContentResponse,
} from './messages.ts';
import type {
  PopupToContentMessage,
  YouTubeContentResponse,
} from '../../types/youtube.ts';

export async function getActiveYouTubeTabId(): Promise<number> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id === undefined || !tab.url) {
    throw new Error('The active tab is unavailable.');
  }
  const url = new URL(tab.url);
  if (
    url.origin !== 'https://www.youtube.com' ||
    url.pathname !== '/watch' ||
    !url.searchParams.get('v')?.trim()
  ) {
    throw new Error('Not a supported YouTube video.');
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
  const response: unknown = await chrome.tabs.sendMessage(tabId, message, {
    frameId: 0,
  });
  if (!isYouTubeContentResponse(response)) {
    throw new Error('Invalid response from the YouTube content script.');
  }
  return response;
}
