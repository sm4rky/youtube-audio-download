import type { YouTubePlayerErrorCode } from '../types/youtube.ts';

export class YouTubePlayerError extends Error {
  readonly code: YouTubePlayerErrorCode;

  constructor(code: YouTubePlayerErrorCode, message: string) {
    super(message);
    this.name = 'YouTubePlayerError';
    this.code = code;
  }
}
