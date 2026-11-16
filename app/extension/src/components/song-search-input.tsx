import { useState } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { Input } from './ui/input.tsx';
import { Button } from './ui/button.tsx';
import { useSongSearchStore } from '../stores/song-search.store.ts';
import type { SongSearchInputProps } from '../types/song-search-input.ts';

export function SongSearchInput({ id, onSubmitted }: SongSearchInputProps) {
  const query = useSongSearchStore((state) => state.query);
  const validationError = useSongSearchStore((state) => state.validationError);
  const [draft, setDraft] = useState(query);
  return <form className="shrink-0" onSubmit={(event) => {
    event.preventDefault();
    useSongSearchStore.getState().submit(draft);
    const submitted = useSongSearchStore.getState();
    if (!submitted.validationError) onSubmitted(submitted.query === query);
  }}>
    <label htmlFor={id} className="sr-only">Search Genius</label>
    <div className="relative">
      <Search className="pointer-events-none absolute top-3 left-3 size-4 text-[#2a1a11]/45" aria-hidden="true" />
      <Input id={id} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Search for another song on Genius..." autoComplete="off" aria-invalid={Boolean(validationError)} aria-describedby={validationError ? id + '-error' : undefined} className="h-10 rounded-full border-[#2a1a11]/15 bg-transparent! pr-11 pl-9 text-xs! shadow-none focus-visible:border-[#d97439]/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#d97439]/25 aria-invalid:ring-inset" />
      <Button type="submit" variant="ghost" size="icon-sm" aria-label="Search songs" className="absolute top-1 right-1 cursor-pointer rounded-full text-[#99491f] hover:bg-[#d97439]/12"><ArrowRight className="size-4" aria-hidden="true" /></Button>
    </div>
    {validationError && <p id={id + '-error'} role="alert" className="mt-2 text-[11px] text-[#a33b24]">{validationError}</p>}
  </form>;
}
