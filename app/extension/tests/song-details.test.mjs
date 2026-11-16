import assert from 'node:assert/strict';
import { test } from 'node:test';
import { connectYouTubePlayback } from '../src/lib/youtube-playback-client.ts';
import { songDetailSchema } from '../src/schemas/songs.schema.ts';
import { songDetailOptions, songSearchOptions } from '../src/queries/songs.queries.ts';
import { createSelectedSongStore } from '../src/stores/selected-song.store.ts';
import { createNavigationStore } from '../src/stores/navigation.store.ts';
import { QueryClient } from '@tanstack/react-query';
import { persistQueryClientSave, persistQueryClientRestore } from '@tanstack/react-query-persist-client';
import { queryCachePersistOptions } from '../src/lib/query-cache-persister.ts';
import { apiClient } from '../src/api/api-client.ts';

const snapshot = { videoId: 'A', title: 'Video', currentTimeMs: 1000, durationMs: 60000, paused: true, playbackRate: 1 };
const detail = { geniusId: 1, title: 'Song', artistName: 'Artist', primaryArtists: [{ geniusId: 2, name: 'Artist' }], featuredArtists: [{ geniusId: 3, name: 'Guest' }], album: { geniusId: 4, title: 'Album' }, year: null, coverUrl: null, geniusUrl: null, media: [] };
function chromeMock(t) {
  const original = globalThis.chrome; const values = new Map(); let receive; let disconnect; let disconnected = false;
  const commands = [];
  globalThis.chrome = { runtime: {}, storage: { session: {
    async get(key) { return { [key]: values.get(key) }; }, async set(items) { for (const [key, value] of Object.entries(items)) values.set(key, value); }, async remove(key) { values.delete(key); },
  } }, tabs: {
    async query() { return [{ id: 42, url: 'https://www.youtube.com/watch?v=A' }]; },
    connect() { return { onMessage: { addListener(fn) { receive = fn; } }, onDisconnect: { addListener(fn) { disconnect = fn; } }, disconnect() { disconnected = true; } }; },
    async sendMessage(id, message) { commands.push(message); return { ok: true, snapshot: { ...snapshot, currentTimeMs: 4300 } }; },
  } };
  t.after(() => { globalThis.chrome = original; });
  return { emit: (message) => receive(message), disconnect: () => disconnect(), commands, get disconnected() { return disconnected; } };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('playback receives initial and native clock/duration/pause/rate updates; media replacement preserves identity', async (t) => {
  const mock = chromeMock(t); const states = []; let changes = 0;
  const connection = connectYouTubePlayback('A', (state) => states.push(state), () => changes++);
  await tick();
  for (const update of [snapshot, { ...snapshot, currentTimeMs: 8000, paused: false }, { ...snapshot, durationMs: 90000, playbackRate: 1.5 }, { ...snapshot, paused: true }]) {
    mock.emit({ videoId: 'A', available: true, response: { ok: true, snapshot: update } });
    assert.deepEqual(states.at(-1).snapshot, update);
  }
  mock.emit({ videoId: 'A', available: false, response: { ok: true, snapshot: { ...snapshot, durationMs: 15000, currentTimeMs: 0 } } });
  assert.equal(states.at(-1).available, false); assert.equal(changes, 0);
  mock.emit({ videoId: 'A', available: true, response: { ok: true, snapshot } });
  assert.equal(states.at(-1).available, true);
  connection.dispose(); assert.equal(mock.disconnected, true);
});

test('pause/resume/seek use bridge replies and later snapshots reconcile seek latency', async (t) => {
  const mock = chromeMock(t); const states = [];
  const connection = connectYouTubePlayback('A', (state) => states.push(state), () => assert.fail('unexpected change'));
  await tick();
  for (const message of [{ type: 'youtube/pause' }, { type: 'youtube/resume' }, { type: 'youtube/seek-to', timeMs: 20000 }]) await connection.command(message);
  assert.deepEqual(mock.commands, [{ type: 'youtube/pause' }, { type: 'youtube/resume' }, { type: 'youtube/seek-to', timeMs: 20000 }]);
  assert.equal(states.at(-1).snapshot.currentTimeMs, 4300);
  mock.emit({ videoId: 'A', available: true, response: { ok: true, snapshot: { ...snapshot, currentTimeMs: 19900 } } });
  assert.equal(states.at(-1).snapshot.currentTimeMs, 19900); connection.dispose();
});

test('watch URL change abandons old playback once and ignores late A events/commands', async (t) => {
  const mock = chromeMock(t); let changes = 0; const states = [];
  const connection = connectYouTubePlayback('A', (state) => states.push(state), () => changes++);
  await tick(); mock.emit({ videoId: 'B', available: false, response: { ok: false, error: { code: 'PLAYER_UNAVAILABLE', message: 'Video changing.' } } });
  mock.emit({ videoId: 'A', available: true, response: { ok: true, snapshot } });
  await connection.command({ type: 'youtube/resume' });
  assert.equal(changes, 1); assert.equal(states.at(-1).snapshot, null); assert.equal(mock.commands.length, 0); connection.dispose();
});

test('selection and details navigation restore; Back retains cached search; detail HTTP validates unknown JSON and persists', async (t) => {
  chromeMock(t);
  const selected = createSelectedSongStore(); const navigation = createNavigationStore();
  selected.getState().selectSong(1); navigation.getState().setView('song-details');
  const reopened = createSelectedSongStore(); const reopenedNavigation = createNavigationStore();
  await Promise.all([reopened.persist.rehydrate(), reopenedNavigation.persist.rehydrate()]);
  assert.equal(reopened.getState().selectedSongId, 1); assert.equal(reopenedNavigation.getState().view, 'song-details');
  const defaults = { ...apiClient.defaults }; let requests = 0;
  apiClient.defaults.baseURL = 'https://api.example.com/api/v1';
  apiClient.defaults.env = { ...defaults.env, fetch: async (request) => { requests++; assert.equal(new URL(request.url).pathname, '/api/v1/songs/1'); return Response.json(detail); } };
  t.after(() => Object.assign(apiClient.defaults, defaults));
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false, gcTime: Infinity } } });
  const restored = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false, gcTime: Infinity } } });
  t.after(() => { client.clear(); restored.clear(); });
  const searchKey = songSearchOptions('Manual query').queryKey;
  client.setQueryData(searchKey, { query: 'Manual query', items: [] });
  assert.deepEqual(await client.fetchQuery(songDetailOptions(1)), detail);
  await persistQueryClientSave({ queryClient: client, ...queryCachePersistOptions });
  await persistQueryClientRestore({ queryClient: restored, ...queryCachePersistOptions });
  assert.deepEqual(await restored.fetchQuery(songDetailOptions(1)), detail); assert.equal(requests, 1);
  reopenedNavigation.getState().setView('search-results');
  assert.deepEqual(restored.getQueryData(searchKey), { query: 'Manual query', items: [] }); assert.equal(requests, 1);
  assert.equal(songDetailSchema.safeParse({ ...detail, album: { title: 'Missing identity' } }).success, false);
  // Different-video application bootstrap also clears selected identity.
  reopened.getState().selectSong(null); reopenedNavigation.getState().setView('loading');
  assert.equal(reopened.getState().selectedSongId, null); assert.equal(reopenedNavigation.getState().view, 'loading');
});
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

test('built content stream uses native media events, watches URL identity and cleans up on disconnect', () => {
  const content = readFileSync(new URL('../dist/content.js', import.meta.url), 'utf8');
  class Video { readyState = 4; currentTime = 1; duration = 60; paused = true; playbackRate = 1; }
  const state = { video: new Video(), href: 'https://www.youtube.com/watch?v=A', ad: false };
  const events = new Map(); let connect; let check; let disconnected; let cleared = false;
  const messages = [];
  const location = { get href() { return state.href; } };
  const document = { title: 'Title', querySelector(selector) { if (selector.includes('ad-showing')) return state.ad ? {} : null; if (selector.includes('video')) return state.video; return null; }, addEventListener(event, fn) { events.set(event, fn); }, removeEventListener(event) { events.delete(event); } };
  runInNewContext(content, { document, location, window: { location }, HTMLVideoElement: Video, URL,
    setInterval(fn) { check = fn; return 1; }, clearInterval() { cleared = true; },
    chrome: { runtime: { id: 'test', onMessage: { addListener() {} }, onConnect: { addListener(fn) { connect = fn; } } } },
  });
  connect({ name: 'audiomint-playback', sender: { id: 'test' }, postMessage(message) { messages.push(structuredClone(message)); }, onDisconnect: { addListener(fn) { disconnected = fn; } } });
  assert.equal(messages[0].response.snapshot.currentTimeMs, 1000);
  state.video.currentTime = 9; state.video.duration = 90; state.video.paused = false; state.video.playbackRate = 1.5;
  events.get('timeupdate')({ target: state.video });
  assert.equal(messages.at(-1).response.snapshot.currentTimeMs, 9000);
  assert.equal(messages.at(-1).response.snapshot.durationMs, 90000);
  assert.equal(messages.at(-1).response.snapshot.paused, false);
  assert.equal(messages.at(-1).response.snapshot.playbackRate, 1.5);
  state.ad = true; check(); assert.equal(messages.at(-1).available, false); assert.equal(messages.at(-1).videoId, 'A');
  state.ad = false; state.video = new Video(); check(); assert.equal(messages.at(-1).available, true); assert.equal(messages.at(-1).videoId, 'A');
  state.href = 'https://www.youtube.com/watch?v=B'; events.get('yt-navigate-finish')(); assert.equal(messages.at(-1).videoId, 'B');
  disconnected(); assert.equal(cleared, true); assert.equal(events.size, 0);
});


test('malformed playback envelopes cannot change session identity or update player state', async (t) => {
  const mock = chromeMock(t);
  const states = [];
  let changes = 0;
  const connection = connectYouTubePlayback('A', (state) => states.push(state), () => { changes += 1; });
  await tick();
  for (const message of [
    null,
    { videoId: 42, available: true, response: { ok: true, snapshot } },
    { videoId: 'B', available: 'yes', response: { ok: true, snapshot } },
    { videoId: 'B', available: false },
    { videoId: 'B', available: true, response: { ok: true, snapshot: { ...snapshot, paused: 'no' } } },
  ]) {
    mock.emit(message);
  }
  assert.equal(states.length, 0);
  assert.equal(changes, 0);
  mock.emit({ videoId: 'A', available: true, response: { ok: true, snapshot } });
  assert.deepEqual(states.at(-1), { snapshot, available: true });
  connection.dispose();
});
