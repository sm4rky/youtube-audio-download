import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { persistQueryClientRestore, persistQueryClientSave } from '@tanstack/react-query-persist-client';
import { apiClient } from '../src/api/api-client.ts';
import { searchLyrics } from '../src/api/lyrics.api.ts';
import { songDetailOptions } from '../src/queries/songs.queries.ts';
import { lyricsSearchOptions } from '../src/queries/lyrics.queries.ts';
import { getLyricsCriteria } from '../src/hooks/use-song-details.ts';
import { lyricsSearchResponseSchema } from '../src/schemas/lyrics.schema.ts';
import { parseSyncedLyrics, findActiveLyricIndex } from '../src/lib/synced-lyrics.ts';
import { queryCachePersistOptions } from '../src/lib/query-cache-persister.ts';
import { createSongDraftStore } from '../src/stores/song-draft.store.ts';

const song = {
  geniusId: 1, title: 'Test Song', artistName: 'First, Second ft. Guest',
  primaryArtists: [{ geniusId: 2, name: 'First' }, { geniusId: 3, name: 'Second' }],
  featuredArtists: [{ geniusId: 4, name: 'Guest' }], album: { geniusId: 5, title: 'Test Album' },
  coverUrl: null, year: 2026, geniusUrl: null, media: [],
};
const lyrics = {
  lrclibId: 10, trackName: 'Test Song', artistName: 'First', albumName: 'Test Album',
  duration: 127.543, instrumental: false, plainLyrics: 'First line\nSecond line',
  syncedLyrics: '[00:01.005] First line\n[00:02.50]\n[00:03] Second line',
};
const response = {
  query: { title: 'Test Song', artist: 'First', album: 'Test Album', duration: 127.543 }, lyrics,
};

function mockTransport(t, respond) {
  const { env, baseURL } = apiClient.defaults;
  const requests = [];
  apiClient.defaults.baseURL = 'https://api.example.com/api/v1';
  apiClient.defaults.env = {
    ...env,
    fetch: async (request) => {
      requests.push(new URL(request.url));
      return respond(request);
    },
  };
  t.after(() => Object.assign(apiClient.defaults, { env, baseURL }));
  return requests;
}

function client(t) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity } } });
  t.after(() => queryClient.clear());
  return queryClient;
}

function mockStorage(t) {
  const original = globalThis.chrome;
  const values = new Map();
  globalThis.chrome = { storage: { session: {
    async get(key) { return { [key]: values.get(key) }; },
    async set(items) { for (const [key, value] of Object.entries(items)) values.set(key, value); },
    async remove(key) { values.delete(key); },
  } } };
  t.after(() => { globalThis.chrome = original; });
  return values;
}

async function waitFor(condition) {
  const deadline = Date.now() + 2000;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for query state.');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

test('dependent lyrics request waits for successful detail and uses first primary artist and YouTube seconds', async (t) => {
  let finishDetail;
  const requests = mockTransport(t, (request) => {
    if (new URL(request.url).pathname.endsWith('/songs/1')) {
      return new Promise((resolve) => { finishDetail = () => resolve(Response.json(song)); });
    }
    return Response.json(response);
  });
  const queryClient = client(t);
  const detailObserver = new QueryObserver(queryClient, songDetailOptions(1));
  const lyricsObserver = new QueryObserver(queryClient, lyricsSearchOptions(null));
  const unsubscribeLyrics = lyricsObserver.subscribe(() => {});
  const unsubscribeDetail = detailObserver.subscribe((state) => {
    lyricsObserver.setOptions(lyricsSearchOptions(state.isSuccess ? getLyricsCriteria(state.data, 127543) : null));
  });
  t.after(() => { unsubscribeDetail(); unsubscribeLyrics(); });
  await waitFor(() => requests.length === 1);
  assert.equal(requests[0].pathname, '/api/v1/songs/1');
  assert.equal(lyricsObserver.getCurrentResult().fetchStatus, 'idle');
  finishDetail();
  await waitFor(() => lyricsObserver.getCurrentResult().isSuccess);
  assert.equal(requests.length, 2);
  assert.deepEqual(Object.fromEntries(requests[1].searchParams), {
    title: 'Test Song', artist: 'First', album: 'Test Album', duration: '127.543',
  });
});

test('missing detail/artist disables lyrics and absent album/unknown duration are omitted', async (t) => {
  assert.equal(getLyricsCriteria(undefined, 1000), null);
  assert.equal(getLyricsCriteria({ ...song, primaryArtists: [] }, 1000), null);
  assert.equal(lyricsSearchOptions(null).enabled, false);
  const requests = mockTransport(t, () => Response.json({ ...response, lyrics: null }));
  const criteria = getLyricsCriteria({ ...song, album: null }, null);
  await client(t).fetchQuery(lyricsSearchOptions(criteria));
  assert.deepEqual(Object.fromEntries(requests[0].searchParams), { title: 'Test Song', artist: 'First' });
  await assert.rejects(client(t).fetchQuery(lyricsSearchOptions(null)));
  assert.equal(requests.length, 1);
});

test('Zod accepts missing lyrics and independent nullable/empty plain and synced values', () => {
  for (const record of [
    null,
    { ...lyrics, plainLyrics: null },
    { ...lyrics, syncedLyrics: null },
    { ...lyrics, plainLyrics: '', syncedLyrics: '' },
    { ...lyrics, duration: null, albumName: null, instrumental: true, plainLyrics: null, syncedLyrics: null },
  ]) {
    assert.equal(lyricsSearchResponseSchema.safeParse({ ...response, lyrics: record }).success, true);
  }
  assert.equal(lyricsSearchResponseSchema.safeParse({ ...response, lyrics: { ...lyrics, lrclibId: '10' } }).success, false);
  assert.equal(lyricsSearchResponseSchema.safeParse({ ...response, lyrics: { ...lyrics, syncedLyrics: [] } }).success, false);
});

test('invalid backend lyrics never enter the successful query cache', async (t) => {
  mockTransport(t, () => Response.json({ ...response, lyrics: { ...lyrics, plainLyrics: 42 } }));
  const queryClient = client(t);
  const options = lyricsSearchOptions(getLyricsCriteria(song, 127543));
  await assert.rejects(queryClient.fetchQuery(options), /invalid lyrics response/);
  assert.equal(queryClient.getQueryData(options.queryKey), undefined);
});

test('lyrics HTTP request forwards cancellation', async (t) => {
  mockTransport(t, (request) => new Promise((_, reject) => {
    request.signal.addEventListener('abort', () => reject(request.signal.reason), { once: true });
  }));
  const controller = new AbortController();
  const pending = searchLyrics({ title: 'Song', artist: 'Artist' }, controller.signal);
  controller.abort();
  await assert.rejects(pending, (error) => error.code === 'ERR_CANCELED');
});

test('LRC parser preserves millisecond fractions, repeated timestamps, stable order and empty timed gaps', () => {
  const lines = parseSyncedLyrics('[ar:Artist]\n[01:02.7] Later\n[00:01.005][00:02.50] Repeated\n[00:03.12]\n[00:03.120] Same time\ninvalid\n[00:99.00] Invalid time');
  assert.deepEqual(lines.map(({ timeMs, text }) => ({ timeMs, text })), [
    { timeMs: 1005, text: 'Repeated' }, { timeMs: 2500, text: 'Repeated' },
    { timeMs: 3120, text: '' }, { timeMs: 3120, text: 'Same time' },
    { timeMs: 62700, text: 'Later' },
  ]);
  assert.equal(new Set(lines.map((line) => line.id)).size, lines.length);
  for (const input of [null, '', '   ', '[ar:Artist]', 'Unstamped words']) {
    assert.deepEqual(parseSyncedLyrics(input), []);
  }
});

test('active lyric lookup follows forward playback, backward/forward seeking and intentional gaps', () => {
  const lines = parseSyncedLyrics('[00:01] One\n[00:03.500]\n[00:06] Two\n[00:09]');
  const positions = [0, 1000, 3499, 3500, 5999, 6000, 1000, 9000, 7000];
  assert.deepEqual(positions.map((position) => findActiveLyricIndex(lines, position)), [-1, 0, 0, 1, 1, 2, 0, 3, 2]);
  assert.equal(lines[findActiveLyricIndex(lines, 4000)].text, '');
  assert.equal(findActiveLyricIndex([], 1000), -1);
  assert.equal(findActiveLyricIndex(lines, NaN), -1);
});

test('draft persists original/current independently and same-song refetch preserves user changes', async (t) => {
  const values = mockStorage(t);
  const store = createSongDraftStore();
  store.getState().initializeDraft({ videoId: 'A', song, lyrics });
  const original = structuredClone(store.getState().draft.original);
  const metadata = { ...store.getState().draft.current.metadata, title: 'Edited title' };
  store.getState().updateDraft({ videoId: 'A', geniusId: 1 }, { metadata, plainLyrics: 'Edited words', syncedLyrics: '[00:05] Edited' });
  store.getState().initializeDraft({ videoId: 'A', song: { ...song, title: 'Refetched title' }, lyrics: { ...lyrics, plainLyrics: 'Refetched words' } });
  const reopened = createSongDraftStore();
  await reopened.persist.rehydrate();
  assert.equal(reopened.getState().draft.current.metadata.title, 'Edited title');
  assert.equal(reopened.getState().draft.current.plainLyrics, 'Edited words');
  assert.deepEqual(reopened.getState().draft.original, original);
  assert.equal(song.title, 'Test Song');
  assert.equal(lyrics.plainLyrics, 'First line\nSecond line');
  assert.equal(values.get('audiomint-song-draft-v1').includes('currentTimeMs'), false);
});

test('draft identity prevents stale edits and isolates different videos and selected songs', (t) => {
  mockStorage(t);
  const store = createSongDraftStore();
  store.getState().initializeDraft({ videoId: 'A', song, lyrics });
  store.getState().updateDraft({ videoId: 'B', geniusId: 1 }, { plainLyrics: 'Stale edit' });
  assert.equal(store.getState().draft.current.plainLyrics, lyrics.plainLyrics);
  store.getState().initializeDraft({ videoId: 'B', song, lyrics: null });
  assert.equal(store.getState().draft.videoId, 'B');
  assert.equal(store.getState().draft.current.syncedLyrics, null);
  store.getState().initializeDraft({ videoId: 'B', song: { ...song, geniusId: 8 }, lyrics });
  assert.equal(store.getState().draft.geniusId, 8);
  store.getState().clearDraft();
  assert.equal(store.getState().draft, null);
});

test('malformed persisted drafts cannot replace actions or restore invalid context', async (t) => {
  const values = mockStorage(t);
  values.set('audiomint-song-draft-v1', JSON.stringify({ version: 1, state: { draft: { videoId: 42 }, clearDraft: 'bad' } }));
  const store = createSongDraftStore();
  await store.persist.rehydrate();
  assert.equal(store.getState().draft, null);
  assert.equal(typeof store.getState().clearDraft, 'function');
});

test('successful lyrics including null matches persist and restore with the query cache', async (t) => {
  mockStorage(t);
  const first = client(t);
  const restored = client(t);
  const options = lyricsSearchOptions(getLyricsCriteria(song, 127543));
  first.setQueryData(options.queryKey, { ...response, lyrics: null });
  await persistQueryClientSave({ queryClient: first, ...queryCachePersistOptions });
  await persistQueryClientRestore({ queryClient: restored, ...queryCachePersistOptions });
  assert.deepEqual(restored.getQueryData(options.queryKey), { ...response, lyrics: null });
});
