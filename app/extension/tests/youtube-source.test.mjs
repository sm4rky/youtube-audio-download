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
