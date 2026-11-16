import { motion, useReducedMotion } from 'motion/react';
import { findActiveLyricIndex } from '../lib/synced-lyrics.ts';
import type { SyncedLyricsProps } from '../types/song-media.ts';

export function SyncedLyrics({ lines, currentTimeMs }: SyncedLyricsProps) {
  const reducedMotion = useReducedMotion();
  const active = findActiveLyricIndex(lines, currentTimeMs);
  const center = Math.max(active, 0);
  const start = Math.max(0, center - 3);
  const visible = lines.slice(start, center + 4);

  return (
    <div
      aria-label="Synced lyrics"
      className="relative h-full w-full overflow-hidden text-center"
      style={{ maskImage: 'linear-gradient(transparent, black 18%, black 82%, transparent)' }}
    >
      {visible.map((line, offset) => {
        const index = start + offset;
        return (
          <motion.p
            key={line.id}
            aria-current={index === active ? true : undefined}
            aria-label={index === active && line.text === '' ? 'Instrumental break' : undefined}
            initial={false}
            animate={{
              y: (index - center) * 56 - 28,
              opacity: index === active ? 1 : index < center ? 0.3 : 0.5,
            }}
            transition={{ duration: reducedMotion ? 0 : 0.2, ease: 'easeOut' }}
            className="absolute top-1/2 left-0 flex h-14 w-full items-center justify-center px-2 text-[18px] leading-[24px] font-medium"
          >
            <span className="line-clamp-2">{line.text}</span>
          </motion.p>
        );
      })}
    </div>
  );
}
