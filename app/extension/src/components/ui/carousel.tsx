// Adapted from shadcn/ui's Embla Carousel primitives for horizontal media slides.
import { createContext, useContext, useEffect } from 'react';
import type { ComponentProps } from 'react';
import useEmblaCarousel, { type UseEmblaCarouselType } from 'embla-carousel-react';
import { cn } from 'cn';

export type CarouselApi = UseEmblaCarouselType[1];

interface CarouselProps extends ComponentProps<'div'> {
  opts?: Parameters<typeof useEmblaCarousel>[0];
  setApi?(api: CarouselApi): void;
}

interface CarouselContextValue {
  carouselRef: UseEmblaCarouselType[0];
}

const CarouselContext = createContext<CarouselContextValue | null>(null);

export function Carousel({ opts, setApi, className, children, ...props }: CarouselProps) {
  const [carouselRef, api] = useEmblaCarousel({ ...opts, axis: 'x' });

  useEffect(() => {
    if (api) setApi?.(api);
  }, [api, setApi]);

  return (
    <CarouselContext.Provider value={{ carouselRef }}>
      <div
        role="region"
        aria-roledescription="carousel"
        data-slot="carousel"
        className={cn('relative', className)}
        onKeyDownCapture={(event) => {
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            api?.scrollPrev();
          } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            api?.scrollNext();
          }
        }}
        {...props}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  );
}

export function CarouselContent({ className, ...props }: ComponentProps<'div'>) {
  const context = useContext(CarouselContext);
  if (!context) throw new Error('CarouselContent must be used within a Carousel.');
  const { carouselRef } = context;
  return (
    <div ref={carouselRef} className="overflow-hidden" data-slot="carousel-content">
      <div className={cn('flex -ml-4 touch-pan-y', className)} {...props} />
    </div>
  );
}

export function CarouselItem({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      role="group"
      aria-roledescription="slide"
      data-slot="carousel-item"
      className={cn('min-w-0 shrink-0 grow-0 basis-full pl-4', className)}
      {...props}
    />
  );
}
