import { YOUTUBE_MESSAGE } from '../lib/youtube-messages.ts';
import type { SongDetailsScreenProps } from '../types/song-details.ts';
import { useState } from 'react';
import { Play, Pause, Download, SlidersHorizontal, Pencil, RotateCcw, RotateCw } from 'lucide-react';
import { Button } from '../components/ui/button.tsx';
import { SongSearchInput } from '../components/song-search-input.tsx';
import { SongDetailsSkeleton } from '../components/song-details-skeleton.tsx';
import { useSongDetails } from '../hooks/use-song-details.ts';
import { SongMedia } from '../components/song-media.tsx';
import { useSongSearchStore } from '../stores/song-search.store.ts';
import { useNavigationStore } from '../stores/navigation.store.ts';

function time(ms: number | null) {
  if (ms === null) return '--:--';
  const seconds = Math.floor(ms / 1000);
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
}

export function SongDetailsScreen({ playback }: SongDetailsScreenProps) {
  const { selectedId, detail, draft, lines, pending, lyricsUnavailable } = useSongDetails(playback);
  const query = useSongSearchStore((state) => state.query);
  const [target, setTarget] = useState<number | null>(null);
  const song = draft?.current.metadata;
  const snapshot = playback.snapshot;
  const duration = snapshot?.durationMs ?? null;
  const current = target ?? snapshot?.currentTimeMs ?? 0;
  const interactive = playback.available && snapshot !== null;
  const commitSeek = () => {
    if (target !== null && interactive) void playback.command({ type: YOUTUBE_MESSAGE.SEEK_TO, timeMs: target });
    setTarget(null);
  };
  const artists = song ? song.primaryArtists.map((artist) => artist.name).join(', ') + (song.featuredArtists.length ? ' ft. ' + song.featuredArtists.map((artist) => artist.name).join(', ') : '') : '';
  return <section className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pt-3 pb-1">
    <SongSearchInput key={query} id="detail-query" onSubmitted={() => useNavigationStore.getState().setView('search-results')} />
    {selectedId === null ? <p role="status">Select a song from search results.</p> : pending ? <SongDetailsSkeleton /> : detail.isError ? <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 text-sm"><p>Song details are unavailable.</p><Button onClick={() => { void detail.refetch(); }}>Retry details</Button></div> : song && <>
      <SongMedia
        key={draft.videoId + ':' + draft.geniusId}
        title={song.title}
        coverUrl={song.coverUrl}
        lines={lyricsUnavailable ? [] : lines}
        currentTimeMs={snapshot?.currentTimeMs ?? 0}
      />
      {lyricsUnavailable && <span className="sr-only" role="status">Lyrics are unavailable.</span>}
      <div className="flex shrink-0 justify-center"><Button variant="outline" size="xs" className="cursor-pointer rounded-lg border-[#2a1a11]/15 bg-transparent px-2.5 text-[10px] hover:bg-[#2a1a11]/5 active:scale-95 motion-reduce:transform-none"><Pencil className="size-2.5" />Edit Lyrics</Button></div>
      <div className="min-w-0 shrink-0">
        <h1 title={song.title} className="truncate text-xl font-semibold tracking-tight">{song.title}</h1>
        {song.album && <p title={song.album.title} className="mt-1 cursor-pointer truncate text-[11px] opacity-55 transition-opacity hover:opacity-100">{song.album.title}</p>}
        <p title={artists} className="truncate text-xs text-[#2a1a11]/65">
          {song.primaryArtists.map((artist, index) => <span key={artist.geniusId}>{index > 0 && ', '}<span className="cursor-pointer transition-colors hover:text-[#2a1a11]">{artist.name}</span></span>)}
          {song.featuredArtists.length > 0 && ' ft. '}
          {song.featuredArtists.map((artist, index) => <span key={artist.geniusId}>{index > 0 && ', '}<span className="cursor-pointer transition-colors hover:text-[#2a1a11]">{artist.name}</span></span>)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        <span className="w-8 shrink-0 text-center text-[10px] tabular-nums opacity-65">{time(current)}</span>
        <input aria-label="Playback position" type="range" min={0} max={duration ?? 1} step={100} value={Math.min(current, duration ?? 0)} disabled={!interactive || !duration} onChange={(event) => setTarget(Number(event.target.value))} onPointerUp={commitSeek} onPointerCancel={() => setTarget(null)} onBlur={commitSeek} onKeyUp={(event) => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) commitSeek(); }} className="h-[3px] min-w-0 flex-1 cursor-pointer appearance-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#d97439]/50 focus-visible:ring-offset-4 [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#fff3df] [&::-webkit-slider-thumb]:bg-[#d97439] [&::-webkit-slider-thumb]:shadow-sm disabled:cursor-default disabled:opacity-40" style={{ background: 'linear-gradient(to right, #d97439 ' + (duration ? Math.min(current / duration, 1) * 100 : 0) + '%, #d5c4af 0%)' }} />
        <span className="w-8 shrink-0 text-center text-[10px] tabular-nums opacity-65">{time(duration)}</span>
      </div>
      <div className="flex shrink-0 items-center justify-center gap-6" role="group" aria-label="Playback controls">
        <Button variant="ghost" size="icon" aria-label="Rewind 5 seconds" disabled={!interactive} onClick={() => { void playback.command({ type: YOUTUBE_MESSAGE.SEEK_BY, deltaMs: -5000 }); }} className="size-9 cursor-pointer border-0 bg-transparent text-[#2a1a11]/65 hover:bg-transparent hover:text-[#d97439] active:scale-90 motion-reduce:transform-none"><span className="relative"><RotateCcw className="size-6!" aria-hidden="true" /><span className="absolute inset-0 flex items-center justify-center pt-0.5 text-[8px] font-semibold" aria-hidden="true">5</span></span></Button>
        <Button variant="ghost" size="icon" aria-label={snapshot?.paused === false ? 'Pause' : 'Play'} disabled={!interactive} onClick={() => { void playback.command({ type: snapshot?.paused === false ? YOUTUBE_MESSAGE.PAUSE : YOUTUBE_MESSAGE.RESUME }); }} className="size-9 cursor-pointer border-0 bg-transparent text-[#2a1a11] hover:bg-transparent hover:text-[#d97439] active:scale-90 motion-reduce:transform-none">{snapshot?.paused === false ? <Pause className="size-7!" fill="currentColor" strokeWidth={0} aria-hidden="true" /> : <Play className="size-7!" fill="currentColor" strokeWidth={0} aria-hidden="true" />}</Button>
        <Button variant="ghost" size="icon" aria-label="Forward 5 seconds" disabled={!interactive} onClick={() => { void playback.command({ type: YOUTUBE_MESSAGE.SEEK_BY, deltaMs: 5000 }); }} className="size-9 cursor-pointer border-0 bg-transparent text-[#2a1a11]/65 hover:bg-transparent hover:text-[#d97439] active:scale-90 motion-reduce:transform-none"><span className="relative"><RotateCw className="size-6!" aria-hidden="true" /><span className="absolute inset-0 flex items-center justify-center pt-0.5 text-[8px] font-semibold" aria-hidden="true">5</span></span></Button>
      </div>
      <div className="flex h-10 shrink-0 items-center rounded-lg bg-[#2a1a11] p-1 text-[#fff3df] shadow-sm">
        <Button variant="ghost" className="h-8 flex-1 cursor-pointer rounded-md border-0 bg-transparent text-xs font-medium text-inherit hover:bg-white/8 hover:text-white active:bg-white/12"><Download className="size-4" />Download MP3</Button>
        <div className="mx-1 h-6 w-px shrink-0 bg-white/15" aria-hidden="true" />
        <Button variant="ghost" size="icon" aria-label="More controls" className="size-8 shrink-0 cursor-pointer rounded-md border-0 bg-transparent text-inherit hover:bg-white/8 hover:text-white active:bg-white/12"><SlidersHorizontal className="size-4" /></Button>
      </div>
    </>}
  </section>;
}
