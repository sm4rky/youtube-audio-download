import { useState } from 'react';
import { useSelectedSongStore } from '../stores/selected-song.store.ts';
import { useNavigationStore } from '../stores/navigation.store.ts';
import { Music2 } from 'lucide-react';
import type { SongSummary } from '../types/song.ts';

interface SongResultProps {
  song: SongSummary;
}

export function SongResult({ song }: SongResultProps) {
  const [failedArtwork, setFailedArtwork] = useState<string | null>(null);
  return (
    <button
      type="button"
      onClick={() => { useSelectedSongStore.getState().selectSong(song.geniusId); useNavigationStore.getState().setView('song-details'); }}
      className="flex w-full cursor-pointer items-center gap-3 rounded-[14px] border border-[#2a1a11]/8 bg-[#fff9ee]/60 p-3 text-left transition-[background-color,border-color] duration-150 outline-none hover:border-[#d97439]/30 hover:bg-[#fff9ee] focus-visible:ring-2 focus-visible:ring-[#d97439]/50 active:bg-[#efd1ab]/45"
    >
      <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-[9px] bg-[#2a1a11]/7 text-[#2a1a11]/35">
        {song.coverUrl && failedArtwork !== song.coverUrl ? (
          <img
            src={song.coverUrl}
            alt=""
            className="size-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setFailedArtwork(song.coverUrl)}
          />
        ) : <Music2 className="size-5" aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] leading-[18px] font-semibold wrap-break-word">{song.title}</span>
        <span className="mt-0.5 block truncate text-[11.5px] leading-[17px] text-[#2a1a11]/65">{song.artistName}</span>
        {song.year !== null && <span className="mt-0.5 block text-[10.5px] text-[#2a1a11]/45">{song.year}</span>}
      </span>
    </button>
  );
}
