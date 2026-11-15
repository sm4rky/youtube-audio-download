import { z } from 'zod';

export const navigationStateSchema = z.object({
  view: z.enum(['loading', 'search-results']),
});
