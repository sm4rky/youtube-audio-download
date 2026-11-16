import { z } from 'zod';

export const selectedSongStateSchema = z.object({ selectedSongId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).nullable() });
