import { z } from 'zod';
import {
  searchQueryLength,
  SEARCH_QUERY_MAX_LENGTH,
} from '../lib/song-title-normalizer.ts';

const storedQuerySchema = z.string().refine((value) =>
  value === '' || (
    value.trim().length > 0 &&
    value === value.trim() &&
    searchQueryLength(value) <= SEARCH_QUERY_MAX_LENGTH
  ),
);

export const songSearchStateSchema = z.object({
  videoId: z.string().min(1).nullable(),
  title: z.string(),
  automaticQuery: storedQuerySchema,
  query: storedQuerySchema,
});
