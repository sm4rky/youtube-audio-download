export function SongDetailsSkeleton() {
  return (
    <div role="status" className="flex min-h-0 flex-1 flex-col" aria-label="Loading song details">
      <span className="sr-only">Loading song details...</span>
      <div aria-hidden="true" className="flex min-h-0 flex-1 animate-pulse flex-col gap-2 motion-reduce:animate-none">
        <div className="flex min-h-[220px] flex-1 items-center justify-center">
          <div className="aspect-square w-full max-w-[220px] rounded-2xl bg-[#2a1a11]/8" />
        </div>
        <div className="flex h-7 shrink-0 justify-center">
          <div className="h-full w-24 rounded-lg bg-[#2a1a11]/8" />
        </div>
        <div className="shrink-0 space-y-1">
          <div className="h-7 w-3/4 rounded-md bg-[#2a1a11]/10" />
          <div className="h-4 w-1/2 rounded-md bg-[#2a1a11]/6" />
          <div className="h-4 w-3/5 rounded-md bg-[#2a1a11]/6" />
        </div>
        <div className="flex h-4 shrink-0 items-center gap-2.5">
          <div className="h-2 w-8 rounded-full bg-[#2a1a11]/8" />
          <div className="h-1 flex-1 rounded-full bg-[#2a1a11]/8" />
          <div className="h-2 w-8 rounded-full bg-[#2a1a11]/8" />
        </div>
        <div className="flex h-9 shrink-0 items-center justify-center gap-6">
          <div className="size-6 rounded-full bg-[#2a1a11]/8" />
          <div className="size-8 rounded-full bg-[#2a1a11]/10" />
          <div className="size-6 rounded-full bg-[#2a1a11]/8" />
        </div>
        <div className="h-10 shrink-0 rounded-lg bg-[#2a1a11]/10" />
      </div>
    </div>
  );
}
