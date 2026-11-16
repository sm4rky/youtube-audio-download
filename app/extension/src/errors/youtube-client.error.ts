import type { YouTubeClientErrorCode } from '../types/youtube.ts';

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
