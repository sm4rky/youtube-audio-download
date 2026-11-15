import { useState } from 'react';
import { ArrowRight, Search, SearchX } from 'lucide-react';
import { Input } from '../components/ui/input.tsx';
import { Button } from '../components/ui/button.tsx';
import { SongResult } from '../components/song-result.tsx';
import { useSongSearchStore } from '../stores/song-search.store.ts';
import type { SongSummary } from '../types/song.ts';

interface SearchResultsScreenProps {
  items: SongSummary[] | undefined;
  pending: boolean;
  fetching: boolean;
  onRetry(): void;
}

export function SearchResultsScreen({ items, pending, fetching, onRetry }: SearchResultsScreenProps) {
  const query = useSongSearchStore((state) => state.query);
  const validationError = useSongSearchStore((state) => state.validationError);
  const [draft, setDraft] = useState(query);

  return (
    <section className="flex min-h-0 flex-1 flex-col pt-6" aria-labelledby="search-results-heading">
      <form onSubmit={(event) => {
        event.preventDefault();
        const store = useSongSearchStore.getState();
        store.submit(draft);
        const submitted = useSongSearchStore.getState();
        if (!submitted.validationError && submitted.query === query) onRetry();
      }}>
        <label htmlFor="song-query" className="sr-only">Search Genius</label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-3 left-3 size-4 text-[#2a1a11]/45" aria-hidden="true" />
          <Input
            id="song-query"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Song or artist"
            autoComplete="off"
            aria-invalid={Boolean(validationError)}
            aria-describedby={validationError ? 'song-query-error' : undefined}
            className="h-10 rounded-xl border-[#2a1a11]/12 bg-[#fff9ee]/65 pr-11 pl-9 text-xs! focus-visible:border-[#d97439]/50 focus-visible:ring-[#d97439]/15"
          />
          <Button
            type="submit"
            variant="ghost"
            size="icon-sm"
            aria-label="Search songs"
            className="absolute top-1 right-1 cursor-pointer rounded-lg text-[#99491f] hover:bg-[#d97439]/12"
          ><ArrowRight className="size-4" aria-hidden="true" /></Button>
        </div>
        {validationError && <p id="song-query-error" role="alert" className="mt-2 text-[11px] text-[#a33b24]">{validationError}</p>}
      </form>

      <div className="mt-6 mb-4 shrink-0">
        <h1 id="search-results-heading" className="text-[23px] leading-tight font-semibold tracking-[-0.6px]">Select a song</h1>
        <p className="mt-1.5 text-[11.5px] text-[#2a1a11]/60">Choose the best match from Genius.</p>
      </div>

      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-1 [scrollbar-color:#d5bba0_transparent] [scrollbar-width:thin]" aria-busy={fetching}>
        {pending ? (
          <div role="status">
            <span className="sr-only">Searching Genius…</span>
            {[0, 1, 2].map((index) => <div key={index} className="mb-2 h-[84px] animate-pulse rounded-[14px] bg-[#2a1a11]/5 motion-reduce:animate-none" />)}
          </div>
        ) : items?.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center" role="status">
            <SearchX className="mb-3 size-7 text-[#b77b4d]" aria-hidden="true" />
            <p className="text-sm font-medium">No matches found</p>
            <p className="mt-2 max-w-[220px] text-xs leading-relaxed text-[#2a1a11]/60">Try a different song title or artist above.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items?.map((song) => (
              <li key={song.geniusId}>
                <SongResult song={song} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
