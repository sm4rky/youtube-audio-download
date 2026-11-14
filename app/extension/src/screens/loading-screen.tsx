import { VinylLoader } from '../components/vinyl-loader.tsx';

export function LoadingScreen() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center pb-8">
      <VinylLoader />
      <div className="mt-6 text-center" role="status" aria-live="polite">
        <h1 className="text-[20px] leading-none font-medium tracking-[-0.015em]">
          Finding your track…
        </h1>
        <p className="mx-auto mt-2 max-w-[228px] text-[11.5px] leading-[1.55] text-[#2a1a11]/60">
          Using the YouTube title to find matches on Genius.
        </p>
      </div>
    </div>
  );
}
