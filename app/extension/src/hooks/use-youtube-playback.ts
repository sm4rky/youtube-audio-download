import { useEffect, useRef, useState } from 'react';
import { connectYouTubePlayback } from '../lib/youtube-playback-client.ts';
import type { PlaybackConnection, PlaybackControls, PlaybackState } from '../types/playback.ts';

// Connect the playback client to React, exposing player state and a command function.
// State comes directly from YouTube and stays in the popup's memory.
export function useYouTubePlayback(
  videoId: string | null,
  onVideoChanged: () => void,
): PlaybackControls {
  const [state, setState] = useState<PlaybackState>({ snapshot: null, available: false });
  const connection = useRef<PlaybackConnection | null>(null);
  const onVideoChangedRef = useRef(onVideoChanged);

  // Keep the latest callback without reopening the connection on each render.
  useEffect(() => {
    onVideoChangedRef.current = onVideoChanged;
  }, [onVideoChanged]);

  // Maintain one connection per videoId and update React state from incoming snapshots.
  useEffect(() => {
    if (!videoId) return;
    const current = connectYouTubePlayback(
      videoId,
      setState,
      () => onVideoChangedRef.current(),
    );
    connection.current = current;
    return () => {
      // Close the connection when videoId changes or the component unmounts.
      current.dispose();
      connection.current = null;
    };
  }, [videoId]);

  return {
    ...state,
    // Forward play/pause/seek commands. Actual player snapshots reconcile the UI.
    command: (message) => connection.current?.command(message),
  };
}
