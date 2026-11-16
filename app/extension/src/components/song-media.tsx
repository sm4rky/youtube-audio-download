import { useEffect, useState } from 'react';
import { Music2 } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from './ui/carousel.tsx';
import { SyncedLyrics } from './synced-lyrics.tsx';
import type { SongMediaProps } from '../types/song-media.ts';

export function SongMedia({ title, coverUrl, lines, currentTimeMs }: SongMediaProps) {
  const [failedArtwork, setFailedArtwork] = useState<string | null>(null);
  const [api, setApi] = useState<CarouselApi>();
  const [slide, setSlide] = useState(0);
  const reducedMotion = useReducedMotion();
  const hasSyncedLyrics = lines.some((line) => line.text.trim().length > 0);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setSlide(api.selectedScrollSnap());
    api.on('select', onSelect);
    api.on('reInit', onSelect);
    return () => {
      api.off('select', onSelect);
      api.off('reInit', onSelect);
    };
  }, [api]);

  const artwork = (
    <div className="group relative mx-auto flex size-[min(100cqw,100cqh)] items-center justify-center overflow-hidden rounded-2xl bg-[#2a1a11]/6 shadow-lg">
      {coverUrl && failedArtwork !== coverUrl ? (
        <img
          src={coverUrl}
          alt={title + ' artwork'}
          referrerPolicy="no-referrer"
          onError={() => setFailedArtwork(coverUrl)}
          className="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04] motion-reduce:transform-none motion-reduce:transition-none"
        />
      ) : <Music2 className="size-16 opacity-25" aria-hidden="true" />}
    </div>
  );

  return (
    <div className="relative min-h-[180px] flex-1" aria-label="Song media">
      {hasSyncedLyrics ? (
        <Carousel key="synced" setApi={setApi} opts={{ startIndex: 0, duration: reducedMotion ? 0 : 25 }} className="absolute inset-0 flex flex-col [&>[data-slot=carousel-content]]:min-h-0 [&>[data-slot=carousel-content]]:flex-1" aria-label="Lyrics and artwork" tabIndex={0}>
          <CarouselContent className="h-full">
            <CarouselItem className="h-full" aria-label="Synced lyrics">
              <SyncedLyrics lines={lines} currentTimeMs={currentTimeMs} />
            </CarouselItem>
            <CarouselItem className="flex h-full items-center justify-center [container-type:size]" aria-label="Cover artwork">{artwork}</CarouselItem>
          </CarouselContent>
          <div className="mt-1 flex h-2 shrink-0 items-center justify-center gap-1.5" aria-label="Media slides">
            <button type="button" aria-label="Show synced lyrics" aria-current={slide === 0 ? true : undefined} onClick={() => api?.scrollTo(0)} className="size-1.5 cursor-pointer rounded-full bg-[#2a1a11]/25 transition-colors outline-none hover:bg-[#2a1a11]/60 focus-visible:ring-2 focus-visible:ring-[#d97439]/50 aria-current:bg-[#2a1a11]/70" />
            <button type="button" aria-label="Show cover artwork" aria-current={slide === 1 ? true : undefined} onClick={() => api?.scrollTo(1)} className="size-1.5 cursor-pointer rounded-full bg-[#2a1a11]/25 transition-colors outline-none hover:bg-[#2a1a11]/60 focus-visible:ring-2 focus-visible:ring-[#d97439]/50 aria-current:bg-[#2a1a11]/70" />
          </div>
        </Carousel>
      ) : <div className="absolute inset-0 flex items-center justify-center [container-type:size]">{artwork}</div>}
    </div>
  );
}
