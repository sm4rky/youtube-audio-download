import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QueryClient } from '@tanstack/react-query';
import { persistQueryClientRestore, persistQueryClientSave } from '@tanstack/react-query-persist-client';
import { createSongSearchStore } from '../src/stores/song-search.store.ts';
import { createNavigationStore } from '../src/stores/navigation.store.ts';
import { chromeSessionStorage } from '../src/lib/chrome-session-storage.ts';
import { queryCachePersistOptions, QUERY_CACHE_MAX_AGE } from '../src/lib/query-cache-persister.ts';
import { queryClient } from '../src/app/query-client.ts';

function mockSessionStorage(t) {
  const original = globalThis.chrome;
  const values = new Map();
  globalThis.chrome = {
    storage: { session: {
      async get(key) { return { [key]: values.get(key) }; },
      async set(items) { for (const [key, value] of Object.entries(items)) values.set(key, value); },
      async remove(key) { values.delete(key); },
    } },
  };
  t.after(() => {
    if (original === undefined) delete globalThis.chrome;
    else globalThis.chrome = original;
  });
  return values;
}

function sourceStore(videoId, title = 'Artist - Song (Official Video)') {
  return createSongSearchStore({
    getActiveTab: async () => ({ tabId: 42, videoId: videoId }),
    getSnapshot: async () => ({
      ok: true,
      snapshot: { videoId, title, currentTimeMs: 0, durationMs: null, paused: true, playbackRate: 1 },
    }),
  });
}

function cache(t) {
  const client = new QueryClient({ defaultOptions: queryClient.getDefaultOptions() });
  t.after(async () => {
    await client.cancelQueries();
    await new Promise((resolve) => setImmediate(resolve));
    client.clear();
  });
  return client;
}

const response = { query: 'Artist - Song', items: [] };
const key = ['songs', 'search', response.query];

test('same-video reopen restores navigation and exact query from older persisted contexts', async (t) => {
  const values = mockSessionStorage(t);
  const first = sourceStore('A');
  const navigation = createNavigationStore();
  await first.getState().initialize();
  first.getState().submit('  Manual   ft. Guest [Official Video]  ');
  navigation.getState().setView('search-results');
  const legacyContext = JSON.parse(values.get('audiomint-song-search-v1'));
  legacyContext.state.selectedSongId = 123;
  values.set('audiomint-song-search-v1', JSON.stringify(legacyContext));
  const reopened = sourceStore('A');
  const reopenedNavigation = createNavigationStore();
  assert.equal(reopened.getState().sourceStatus, 'idle');
  await Promise.all([reopened.persist.rehydrate(), reopenedNavigation.persist.rehydrate()]);
  assert.equal(reopened.getState().sourceStatus, 'idle');
  await reopened.getState().initialize();
  assert.equal(reopened.getState().query, 'Manual   ft. Guest [Official Video]');
  assert.equal('selectedSongId' in reopened.getState(), false);
  assert.equal(reopenedNavigation.getState().view, 'search-results');
  const saved = JSON.parse(values.get('audiomint-song-search-v1')).state;
  assert.deepEqual(Object.keys(saved).sort(), ['automaticQuery', 'query', 'title', 'videoId']);
  assert.equal('items' in reopened.getState(), false);
  assert.deepEqual(JSON.parse(values.get('audiomint-navigation-v1')).state, { view: 'search-results' });
});

test('different-video initialization drops the previous manual query even with the same title', async (t) => {
  mockSessionStorage(t);
  const first = sourceStore('A');
  await first.getState().initialize();
  first.getState().submit('Manual query');
  const reopened = sourceStore('B');
  await reopened.persist.rehydrate();
  await reopened.getState().initialize();
  assert.equal(reopened.getState().videoId, 'B');
  assert.equal(reopened.getState().query, 'Artist - Song');
});

test('reopen restores a submitted manual query without depending on the content script', async (t) => {
  mockSessionStorage(t);
  const first = sourceStore('A');
  await first.getState().initialize();
  first.getState().submit('  My   exact [Official Video] query  ');
  let snapshotReads = 0;
  const reopened = createSongSearchStore({
    getActiveTab: async () => ({ tabId: 42, videoId: 'A' }),
    getSnapshot: async () => { snapshotReads += 1; throw new Error('No receiver'); },
  });
  await reopened.persist.rehydrate();
  await reopened.getState().initialize({ restore: true });
  assert.equal(reopened.getState().sourceStatus, 'ready');
  assert.equal(reopened.getState().query, 'My   exact [Official Video] query');
  assert.equal(snapshotReads, 0);
});

test('temporary tab access failures do not erase the persisted manual search', async (t) => {
  const values = mockSessionStorage(t);
  const first = sourceStore('A');
  await first.getState().initialize();
  first.getState().submit('Manual query');
  let unavailable = true;
  const reopened = createSongSearchStore({
    getActiveTab: async () => {
      if (unavailable) throw new Error('Tab temporarily unavailable');
      return { tabId: 42, videoId: 'A' };
    },
    getSnapshot: async () => { throw new Error('No receiver'); },
  });
  await reopened.persist.rehydrate();
  await reopened.getState().initialize({ restore: true });
  assert.equal(reopened.getState().sourceStatus, 'unavailable');
  assert.equal(reopened.getState().query, 'Manual query');
  assert.equal(JSON.parse(values.get('audiomint-song-search-v1')).state.query, 'Manual query');
  unavailable = false;
  await reopened.getState().initialize({ restore: true });
  assert.equal(reopened.getState().sourceStatus, 'ready');
  assert.equal(reopened.getState().query, 'Manual query');
});

test('a different confirmed video cannot restore old context when its player is unavailable', async (t) => {
  mockSessionStorage(t);
  const first = sourceStore('A');
  await first.getState().initialize();
  first.getState().submit('Manual query');
  const reopened = createSongSearchStore({
    getActiveTab: async () => ({ tabId: 42, videoId: 'B' }),
    getSnapshot: async () => { throw new Error('No receiver'); },
  });
  await reopened.persist.rehydrate();
  await reopened.getState().initialize({ restore: true });
  assert.equal(reopened.getState().sourceStatus, 'unavailable');
  assert.equal(reopened.getState().videoId, 'B');
  assert.equal(reopened.getState().query, '');
  assert.equal(reopened.getState().title, '');
});

test('invalid persisted context/navigation cannot replace store actions or create invalid queries', async (t) => {
  const values = mockSessionStorage(t);
  values.set('audiomint-navigation-v1', JSON.stringify({ version: 1, state: { view: 'download', setView: 'bad' } }));
  values.set('audiomint-song-search-v1', JSON.stringify({ version: 1, state: {
    videoId: 'A', title: 'Title', automaticQuery: 'Title', query: 'a'.repeat(201), selectedSongId: 1,
  } }));
  const source = sourceStore('A');
  const navigation = createNavigationStore();
  await Promise.all([source.persist.rehydrate(), navigation.persist.rehydrate()]);
  assert.equal(navigation.getState().view, 'loading');
  assert.equal(typeof navigation.getState().setView, 'function');
  assert.equal(source.getState().query, '');
  assert.equal(typeof source.getState().initialize, 'function');
});

test('successful search cache survives a new QueryClient and avoids another required fetch', async (t) => {
  mockSessionStorage(t);
  const first = cache(t);
  let requests = 0;
  const options = { queryKey: key, queryFn: async () => { requests += 1; return response; } };
  await first.fetchQuery(options);
  await persistQueryClientSave({ queryClient: first, ...queryCachePersistOptions });
  const reopened = cache(t);
  await persistQueryClientRestore({ queryClient: reopened, ...queryCachePersistOptions });
  assert.deepEqual(await reopened.fetchQuery(options), response);
  assert.equal(requests, 1);
});

test('legacy video-scoped cache is discarded by the new persistence version', async (t) => {
  const values = mockSessionStorage(t);
  const first = cache(t);
  first.setQueryData(key, response);
  await persistQueryClientSave({ queryClient: first, ...queryCachePersistOptions, buster: 'audiomint-search-v1:A' });
  const reopened = cache(t);
  await persistQueryClientRestore({ queryClient: reopened, ...queryCachePersistOptions });
  assert.equal(reopened.getQueryData(key), undefined);
  assert.equal(values.has('audiomint-tanstack-query-cache-v1'), false);
});

test('persistence saves only successful song search queries and excludes unrelated data/errors/mutations', async (t) => {
  const values = mockSessionStorage(t);
  const client = cache(t);
  client.setQueryData(key, response);
  client.setQueryData(['unrelated'], { value: 'do not persist' });
  await assert.rejects(client.fetchQuery({ queryKey: ['songs', 'search', 'Failed'], queryFn: () => Promise.reject(new Error('Failed')) }));
  await persistQueryClientSave({ queryClient: client, ...queryCachePersistOptions });
  const saved = JSON.parse(values.get('audiomint-tanstack-query-cache-v1'));
  assert.deepEqual(saved.clientState.queries.map((query) => query.queryKey), [key]);
  assert.deepEqual(saved.clientState.mutations, []);
});

test('expired and version-busted caches are discarded', async (t) => {
  const values = mockSessionStorage(t);
  for (const versionMismatch of [false, true]) {
    const client = cache(t);
    client.setQueryData(key, response);
    await persistQueryClientSave({ queryClient: client, ...queryCachePersistOptions });
    const saved = JSON.parse(values.get('audiomint-tanstack-query-cache-v1'));
    if (versionMismatch) saved.buster = 'old-version:A';
    else saved.timestamp = Date.now() - QUERY_CACHE_MAX_AGE - 1;
    values.set('audiomint-tanstack-query-cache-v1', JSON.stringify(saved));
    const reopened = cache(t);
    await persistQueryClientRestore({ queryClient: reopened, ...queryCachePersistOptions });
    assert.equal(reopened.getQueryData(key), undefined);
  }
});

test('Chrome storage failures degrade to memory without blocking video initialization', async (t) => {
  mockSessionStorage(t);
  for (const method of ['get', 'set', 'remove']) {
    t.mock.method(globalThis.chrome.storage.session, method, async () => { throw new Error('Storage unavailable'); });
  }
  assert.equal(await chromeSessionStorage.getItem('missing'), null);
  await chromeSessionStorage.setItem('test', 'value');
  await chromeSessionStorage.removeItem('test');
  const source = sourceStore('A');
  await source.persist.rehydrate();
  await source.getState().initialize();
  assert.equal(source.getState().sourceStatus, 'ready');
});
