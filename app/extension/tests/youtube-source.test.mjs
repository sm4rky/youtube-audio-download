import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSongSearchStore } from '../src/stores/song-search.store.ts';

test('disposing a same-video tab read prevents the next player request', async () => {
  let resolveTab;
  let snapshotReads = 0;
  const store = createSongSearchStore({
    getActiveTab: () => new Promise((resolve) => { resolveTab = resolve; }),
    getSnapshot: async () => { snapshotReads += 1; throw new Error('Unexpected request'); },
  });
  store.setState({ videoId: 'A', title: 'Saved title', automaticQuery: 'Saved query', query: 'Manual query' });
  const pending = store.getState().initialize();
  store.getState().dispose();
  resolveTab({ tabId: 42, videoId: 'A' });
  await pending;
  assert.equal(snapshotReads, 0);
  assert.equal(store.getState().query, 'Manual query');
});

test('new watch identity waits for its title instead of submitting the previous video title', async () => {
  let videoId = 'A'; let reads = 0;
  const store = createSongSearchStore({
    getActiveTab: async () => ({ tabId: 42, videoId }),
    getSnapshot: async () => ({ ok: true, snapshot: { videoId, title: videoId === 'A' || reads++ === 0 ? 'Artist - Old Song (Official Video)' : 'Artist - New Song (Official Video)', currentTimeMs: 0, durationMs: 60000, paused: false, playbackRate: 1 } }),
  });
  await store.getState().initialize();
  store.getState().submit('Old manual query');
  const queries = []; const unsubscribe = store.subscribe((state) => { if (state.sourceStatus === 'ready') queries.push(state.query); });
  videoId = 'B'; await store.getState().initialize({ restore: true }); unsubscribe();
  assert.equal(store.getState().query, 'Artist - New Song');
  assert.equal(store.getState().automaticQuery, 'Artist - New Song');
  assert.deepEqual(queries, ['Artist - New Song']); assert.equal(reads, 2);
});
